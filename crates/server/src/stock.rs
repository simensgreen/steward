//! Stock: Locations, Stock Entries, FEFO/FIFO consume command (ADR-0017, ADR-0048).

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;
use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::household::require_household_member;
use crate::util::{new_id, now_rfc3339};

#[derive(Debug, FromRow, Serialize)]
pub struct LocationView {
    pub id: String,
    pub household_id: String,
    pub name: String,
    pub kind: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateLocationRequest {
    pub name: String,
    pub kind: Option<String>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct StockEntryView {
    pub id: String,
    pub household_id: String,
    pub location_id: String,
    pub location_name: String,
    pub product_id: String,
    pub product_name: String,
    pub quantity: f64,
    pub expires_on: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct AddStockRequest {
    pub location_id: String,
    pub product_id: String,
    pub quantity: f64,
    pub expires_on: Option<String>,
}

#[derive(Deserialize)]
pub struct ConsumeStockRequest {
    pub household_id: String,
    pub product_id: String,
    pub quantity: f64,
    pub location_id: Option<String>,
    pub idempotency_key: Option<String>,
}

#[derive(Serialize)]
pub struct ConsumeStockResponse {
    pub consumed: f64,
    pub remaining_needed: f64,
    pub entry_ids: Vec<String>,
}

async fn list_locations(
    State(state): State<AppState>,
    user: AuthUser,
    Path(household_id): Path<String>,
) -> ApiResult<Json<Vec<LocationView>>> {
    require_household_member(&state, &household_id, &user.person_id).await?;
    let rows: Vec<LocationView> = sqlx::query_as(
        "SELECT id, household_id, name, kind, created_at FROM location
         WHERE household_id = ? ORDER BY name COLLATE NOCASE",
    )
    .bind(&household_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_location(
    State(state): State<AppState>,
    user: AuthUser,
    Path(household_id): Path<String>,
    Json(body): Json<CreateLocationRequest>,
) -> ApiResult<Json<LocationView>> {
    require_household_member(&state, &household_id, &user.person_id).await?;
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let kind = body.kind.unwrap_or_else(|| "generic".into());
    if !matches!(kind.as_str(), "generic" | "fridge" | "freezer" | "pantry") {
        return Err(ApiError::BadRequest("invalid location kind".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO location (id, household_id, name, kind, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&household_id)
    .bind(&name)
    .bind(&kind)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "location", &id);
    Ok(Json(LocationView {
        id,
        household_id,
        name,
        kind,
        created_at: now,
    }))
}

async fn list_stock(
    State(state): State<AppState>,
    user: AuthUser,
    Path(household_id): Path<String>,
) -> ApiResult<Json<Vec<StockEntryView>>> {
    require_household_member(&state, &household_id, &user.person_id).await?;
    let rows: Vec<StockEntryView> = sqlx::query_as(
        "SELECT e.id, e.household_id, e.location_id, l.name AS location_name,
                e.product_id, p.name AS product_name, e.quantity, e.expires_on, e.created_at
         FROM stock_entry e
         JOIN location l ON l.id = e.location_id
         JOIN product p ON p.id = e.product_id
         WHERE e.household_id = ? AND e.quantity > 0
         ORDER BY CASE WHEN e.expires_on IS NULL THEN 1 ELSE 0 END, e.expires_on, e.created_at, e.id",
    )
    .bind(&household_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn add_stock(
    State(state): State<AppState>,
    user: AuthUser,
    Path(household_id): Path<String>,
    Json(body): Json<AddStockRequest>,
) -> ApiResult<Json<StockEntryView>> {
    require_household_member(&state, &household_id, &user.person_id).await?;
    if body.quantity <= 0.0 {
        return Err(ApiError::BadRequest("quantity must be > 0".into()));
    }
    let loc: Option<(String,)> =
        sqlx::query_as("SELECT id FROM location WHERE id = ? AND household_id = ?")
            .bind(&body.location_id)
            .bind(&household_id)
            .fetch_optional(&state.pool)
            .await?;
    if loc.is_none() {
        return Err(ApiError::BadRequest("location not in Household".into()));
    }
    let product: Option<(String,)> = sqlx::query_as("SELECT name FROM product WHERE id = ?")
        .bind(&body.product_id)
        .fetch_optional(&state.pool)
        .await?;
    let Some((product_name,)) = product else {
        return Err(ApiError::NotFound("Product not found".into()));
    };
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO stock_entry (id, household_id, location_id, product_id, quantity, expires_on, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&household_id)
    .bind(&body.location_id)
    .bind(&body.product_id)
    .bind(body.quantity)
    .bind(&body.expires_on)
    .bind(&now)
    .execute(&state.pool)
    .await?;

    if let Some(ref expires_on) = body.expires_on {
        let cal: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM calendar WHERE owner_kind = 'household' AND owner_id = ? AND system_kind = 'expiry'",
        )
        .bind(&household_id)
        .fetch_optional(&state.pool)
        .await?;
        if let Some((cal_id,)) = cal {
            let event_id = new_id();
            let title = format!("{product_name} expires");
            sqlx::query(
                "INSERT INTO calendar_event (id, calendar_id, title, starts_on, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(&event_id)
            .bind(&cal_id)
            .bind(&title)
            .bind(expires_on)
            .bind(&id)
            .bind(&now)
            .execute(&state.pool)
            .await?;
        }
    }

    let loc_name: (String,) = sqlx::query_as("SELECT name FROM location WHERE id = ?")
        .bind(&body.location_id)
        .fetch_one(&state.pool)
        .await?;
    state.events.publish("created", "stock_entry", &id);
    Ok(Json(StockEntryView {
        id,
        household_id,
        location_id: body.location_id,
        location_name: loc_name.0,
        product_id: body.product_id,
        product_name,
        quantity: body.quantity,
        expires_on: body.expires_on,
        created_at: now,
    }))
}

async fn consume_stock(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<ConsumeStockRequest>,
) -> ApiResult<Json<ConsumeStockResponse>> {
    require_household_member(&state, &body.household_id, &user.person_id).await?;
    if body.quantity <= 0.0 {
        return Err(ApiError::BadRequest("quantity must be > 0".into()));
    }
    tracing::info!(
        "Consuming stock household={} product={} qty={}",
        body.household_id,
        body.product_id,
        body.quantity
    );

    let mut tx = state.pool.begin().await?;
    let entries: Vec<(String, f64)> = if let Some(ref location_id) = body.location_id {
        sqlx::query_as(
            "SELECT id, quantity FROM stock_entry
             WHERE household_id = ? AND product_id = ? AND location_id = ? AND quantity > 0
             ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END, expires_on, created_at, id",
        )
        .bind(&body.household_id)
        .bind(&body.product_id)
        .bind(location_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as(
            "SELECT id, quantity FROM stock_entry
             WHERE household_id = ? AND product_id = ? AND quantity > 0
             ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END, expires_on, created_at, id",
        )
        .bind(&body.household_id)
        .bind(&body.product_id)
        .fetch_all(&mut *tx)
        .await?
    };

    let mut remaining = body.quantity;
    let mut touched = Vec::new();
    for (entry_id, qty) in entries {
        if remaining <= 0.0 {
            break;
        }
        let take = remaining.min(qty);
        let new_qty = qty - take;
        sqlx::query("UPDATE stock_entry SET quantity = ? WHERE id = ?")
            .bind(new_qty)
            .bind(&entry_id)
            .execute(&mut *tx)
            .await?;
        remaining -= take;
        touched.push(entry_id);
    }

    if remaining > 1e-9 {
        return Err(ApiError::BadRequest(format!(
            "insufficient stock; short by {remaining}"
        )));
    }

    tx.commit().await?;
    tracing::info!(
        "Consumed stock product={} entries={}",
        body.product_id,
        touched.len()
    );
    for id in &touched {
        state.events.publish("updated", "stock_entry", id);
    }
    Ok(Json(ConsumeStockResponse {
        consumed: body.quantity,
        remaining_needed: 0.0,
        entry_ids: touched,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/households/{household_id}/locations",
            get(list_locations).post(create_location),
        )
        .route(
            "/api/v1/households/{household_id}/stock",
            get(list_stock).post(add_stock),
        )
        .route("/api/v1/commands/stock/consume", post(consume_stock))
}
