//! Calendar: Household system calendars + events; Person calendars (ADR-0016, ADR-0023, ADR-0026).

use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;
use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::household::require_household_member;
use crate::util::{new_id, now_rfc3339};

#[derive(Debug, FromRow, Serialize)]
pub struct CalendarView {
    pub id: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub name: String,
    pub system_kind: Option<String>,
    pub created_at: String,
}

#[derive(Debug, FromRow, Serialize)]
pub struct CalendarEventView {
    pub id: String,
    pub calendar_id: String,
    pub title: String,
    pub starts_on: String,
    pub ends_on: Option<String>,
    pub notes: Option<String>,
    pub recipe_id: Option<String>,
    pub portions: Option<f64>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub starts_on: String,
    pub ends_on: Option<String>,
    pub notes: Option<String>,
    pub recipe_id: Option<String>,
    pub portions: Option<f64>,
}

#[derive(Deserialize)]
pub struct CreatePersonCalendarRequest {
    pub name: String,
}

async fn assert_calendar_access(
    state: &AppState,
    calendar: &CalendarView,
    person_id: &str,
) -> ApiResult<()> {
    match calendar.owner_kind.as_str() {
        "household" => {
            require_household_member(state, &calendar.owner_id, person_id).await?;
        }
        "person" => {
            if calendar.owner_id != person_id {
                return Err(ApiError::Forbidden("not your Calendar".into()));
            }
        }
        _ => return Err(ApiError::BadRequest("invalid calendar owner".into())),
    }
    Ok(())
}

async fn list_household_calendars(
    State(state): State<AppState>,
    user: AuthUser,
    Path(household_id): Path<String>,
) -> ApiResult<Json<Vec<CalendarView>>> {
    require_household_member(&state, &household_id, &user.person_id).await?;
    let rows: Vec<CalendarView> = sqlx::query_as(
        "SELECT id, owner_kind, owner_id, name, system_kind, created_at
         FROM calendar WHERE owner_kind = 'household' AND owner_id = ?
         ORDER BY system_kind IS NOT NULL DESC, name COLLATE NOCASE",
    )
    .bind(&household_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn list_my_calendars(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<Vec<CalendarView>>> {
    let rows: Vec<CalendarView> = sqlx::query_as(
        "SELECT id, owner_kind, owner_id, name, system_kind, created_at
         FROM calendar WHERE owner_kind = 'person' AND owner_id = ?
         ORDER BY name COLLATE NOCASE",
    )
    .bind(&user.person_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_person_calendar(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreatePersonCalendarRequest>,
) -> ApiResult<Json<CalendarView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO calendar (id, owner_kind, owner_id, name, system_kind, created_at)
         VALUES (?, 'person', ?, ?, NULL, ?)",
    )
    .bind(&id)
    .bind(&user.person_id)
    .bind(&name)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "calendar", &id);
    Ok(Json(CalendarView {
        id,
        owner_kind: "person".into(),
        owner_id: user.person_id,
        name,
        system_kind: None,
        created_at: now,
    }))
}

async fn list_events(
    State(state): State<AppState>,
    user: AuthUser,
    Path(calendar_id): Path<String>,
) -> ApiResult<Json<Vec<CalendarEventView>>> {
    let calendar: CalendarView = sqlx::query_as(
        "SELECT id, owner_kind, owner_id, name, system_kind, created_at FROM calendar WHERE id = ?",
    )
    .bind(&calendar_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("Calendar not found".into()))?;
    assert_calendar_access(&state, &calendar, &user.person_id).await?;
    let rows: Vec<CalendarEventView> = sqlx::query_as(
        "SELECT id, calendar_id, title, starts_on, ends_on, notes, recipe_id, portions, created_at
         FROM calendar_event WHERE calendar_id = ? ORDER BY starts_on, created_at",
    )
    .bind(&calendar_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_event(
    State(state): State<AppState>,
    user: AuthUser,
    Path(calendar_id): Path<String>,
    Json(body): Json<CreateEventRequest>,
) -> ApiResult<Json<CalendarEventView>> {
    let calendar: CalendarView = sqlx::query_as(
        "SELECT id, owner_kind, owner_id, name, system_kind, created_at FROM calendar WHERE id = ?",
    )
    .bind(&calendar_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("Calendar not found".into()))?;
    assert_calendar_access(&state, &calendar, &user.person_id).await?;
    if calendar.system_kind.as_deref() == Some("expiry") {
        return Err(ApiError::BadRequest(
            "expiry Calendar events are created from Stock Entries".into(),
        ));
    }
    let title = body.title.trim().to_string();
    if title.is_empty() {
        return Err(ApiError::BadRequest("title required".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO calendar_event (id, calendar_id, title, starts_on, ends_on, notes, recipe_id, portions, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&calendar_id)
    .bind(&title)
    .bind(&body.starts_on)
    .bind(&body.ends_on)
    .bind(&body.notes)
    .bind(&body.recipe_id)
    .bind(body.portions)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "calendar_event", &id);
    Ok(Json(CalendarEventView {
        id,
        calendar_id,
        title,
        starts_on: body.starts_on,
        ends_on: body.ends_on,
        notes: body.notes,
        recipe_id: body.recipe_id,
        portions: body.portions,
        created_at: now,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/households/{household_id}/calendars",
            get(list_household_calendars),
        )
        .route(
            "/api/v1/calendars/me",
            get(list_my_calendars).post(create_person_calendar),
        )
        .route(
            "/api/v1/calendars/{calendar_id}/events",
            get(list_events).post(create_event),
        )
}
