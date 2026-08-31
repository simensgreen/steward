//! Household: membership, Default Household, system Calendars (ADR-0002, ADR-0026).

use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;
use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::util::{new_id, now_rfc3339};

#[derive(Debug, FromRow, Serialize)]
pub struct HouseholdView {
    pub id: String,
    pub name: String,
    pub owner_person_id: String,
    pub created_at: String,
    pub role: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateHouseholdRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct AddMemberRequest {
    pub username: String,
    pub role: Option<String>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct MemberView {
    pub person_id: String,
    pub username: String,
    pub display_name: String,
    pub role: String,
    pub created_at: String,
}

pub async fn require_household_member(
    state: &AppState,
    household_id: &str,
    person_id: &str,
) -> ApiResult<String> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM household_member WHERE household_id = ? AND person_id = ?",
    )
    .bind(household_id)
    .bind(person_id)
    .fetch_optional(&state.pool)
    .await?;
    row.map(|r| r.0)
        .ok_or_else(|| ApiError::Forbidden("not a Household member".into()))
}

async fn list_households(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<Vec<HouseholdView>>> {
    let rows: Vec<HouseholdView> = sqlx::query_as(
        "SELECT h.id, h.name, h.owner_person_id, h.created_at, m.role AS role
         FROM household h
         JOIN household_member m ON m.household_id = h.id
         WHERE m.person_id = ?
         ORDER BY h.name COLLATE NOCASE",
    )
    .bind(&user.person_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_household(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateHouseholdRequest>,
) -> ApiResult<Json<HouseholdView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let household_id = new_id();
    let now = now_rfc3339();
    tracing::info!("Creating Household id={household_id}");

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO household (id, name, owner_person_id, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&household_id)
    .bind(&name)
    .bind(&user.person_id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO household_member (household_id, person_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    )
    .bind(&household_id)
    .bind(&user.person_id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    for (system_kind, cal_name) in [("expiry", "Expiry"), ("meal_plan", "Meal plan")] {
        let cal_id = new_id();
        sqlx::query(
            "INSERT INTO calendar (id, owner_kind, owner_id, name, system_kind, created_at)
             VALUES (?, 'household', ?, ?, ?, ?)",
        )
        .bind(&cal_id)
        .bind(&household_id)
        .bind(cal_name)
        .bind(system_kind)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }

    for (loc_name, kind) in [
        ("Pantry", "pantry"),
        ("Fridge", "fridge"),
        ("Freezer", "freezer"),
    ] {
        let loc_id = new_id();
        sqlx::query(
            "INSERT INTO location (id, household_id, name, kind, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&loc_id)
        .bind(&household_id)
        .bind(loc_name)
        .bind(kind)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }

    if user.default_household_id.is_none() {
        sqlx::query("UPDATE person SET default_household_id = ? WHERE id = ?")
            .bind(&household_id)
            .bind(&user.person_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    tracing::info!("Created Household id={household_id}");
    state.events.publish("created", "household", &household_id);

    Ok(Json(HouseholdView {
        id: household_id,
        name,
        owner_person_id: user.person_id,
        created_at: now,
        role: Some("owner".into()),
    }))
}

async fn get_household(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<HouseholdView>> {
    let role = require_household_member(&state, &id, &user.person_id).await?;
    let row: HouseholdView = sqlx::query_as(
        "SELECT id, name, owner_person_id, created_at, ? AS role FROM household WHERE id = ?",
    )
    .bind(&role)
    .bind(&id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("Household not found".into()))?;
    Ok(Json(row))
}

async fn list_members(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<MemberView>>> {
    require_household_member(&state, &id, &user.person_id).await?;
    let rows: Vec<MemberView> = sqlx::query_as(
        "SELECT m.person_id, p.username, p.display_name, m.role, m.created_at
         FROM household_member m
         JOIN person p ON p.id = m.person_id
         WHERE m.household_id = ?
         ORDER BY m.role, p.display_name COLLATE NOCASE",
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn add_member(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<AddMemberRequest>,
) -> ApiResult<Json<MemberView>> {
    let role = require_household_member(&state, &id, &user.person_id).await?;
    if role != "owner" {
        return Err(ApiError::Forbidden("only Owner can add members".into()));
    }
    let member_role = body.role.unwrap_or_else(|| "member".into());
    if !matches!(member_role.as_str(), "member" | "guest") {
        return Err(ApiError::BadRequest("role must be member or guest".into()));
    }
    let person: Option<(String, String, String)> = sqlx::query_as(
        "SELECT id, username, display_name FROM person WHERE username = ? COLLATE NOCASE",
    )
    .bind(body.username.trim())
    .fetch_optional(&state.pool)
    .await?;
    let Some((person_id, username, display_name)) = person else {
        return Err(ApiError::NotFound("Person not found".into()));
    };
    let now = now_rfc3339();
    let result = sqlx::query(
        "INSERT OR IGNORE INTO household_member (household_id, person_id, role, created_at)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&person_id)
    .bind(&member_role)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::Conflict("already a member".into()));
    }
    state.events.publish("updated", "household", &id);
    Ok(Json(MemberView {
        person_id,
        username,
        display_name,
        role: member_role,
        created_at: now,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/households",
            get(list_households).post(create_household),
        )
        .route("/api/v1/households/{id}", get(get_household))
        .route(
            "/api/v1/households/{id}/members",
            get(list_members).post(add_member),
        )
}
