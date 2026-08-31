//! Shopping Lists on Budget/Fund; item lifecycle commands (ADR-0005, ADR-0006, ADR-0047).

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;
use std::collections::HashMap;

use crate::AppState;
use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::household::require_household_member;
use crate::util::{new_id, now_rfc3339, to_minor};

#[derive(Debug, FromRow, Serialize)]
pub struct ShoppingListView {
    pub id: String,
    pub name: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub target_household_id: Option<String>,
    pub created_by_person_id: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateListRequest {
    pub name: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub target_household_id: Option<String>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct ShoppingItemView {
    pub id: String,
    pub shopping_list_id: String,
    pub product_id: String,
    pub product_name: String,
    pub status: String,
    pub quantity_needed: f64,
    pub quantity_purchased: f64,
    pub preferred_store_id: Option<String>,
    pub last_price_minor: Option<i64>,
    pub last_price_currency: Option<String>,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct AddItemRequest {
    pub product_id: String,
    pub quantity_needed: f64,
    pub preferred_store_id: Option<String>,
}

#[derive(Deserialize)]
pub struct SetInCartRequest {
    pub item_id: String,
}

#[derive(Deserialize)]
pub struct PurchaseItemRequest {
    pub item_id: String,
    pub quantity: f64,
    pub store_id: Option<String>,
    /// Required when no Store Price can be resolved.
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub idempotency_key: String,
}

async fn assert_list_access(
    state: &AppState,
    list: &ShoppingListView,
    person_id: &str,
) -> ApiResult<()> {
    match list.owner_kind.as_str() {
        "budget" => {
            let row: Option<(String,)> =
                sqlx::query_as("SELECT id FROM budget WHERE id = ? AND person_id = ?")
                    .bind(&list.owner_id)
                    .bind(person_id)
                    .fetch_optional(&state.pool)
                    .await?;
            if row.is_none() {
                return Err(ApiError::Forbidden("Budget list not owned by you".into()));
            }
        }
        "fund" => {
            let row: Option<(String,)> = sqlx::query_as(
                "SELECT role FROM fund_participant WHERE fund_id = ? AND person_id = ?",
            )
            .bind(&list.owner_id)
            .bind(person_id)
            .fetch_optional(&state.pool)
            .await?;
            if row.is_none() {
                return Err(ApiError::Forbidden("not a Fund participant".into()));
            }
        }
        _ => return Err(ApiError::BadRequest("invalid owner_kind".into())),
    }
    Ok(())
}

async fn load_list(state: &AppState, id: &str) -> ApiResult<ShoppingListView> {
    sqlx::query_as(
        "SELECT id, name, owner_kind, owner_id, target_household_id, created_by_person_id, created_at
         FROM shopping_list WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("Shopping List not found".into()))
}

async fn list_shopping_lists(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<Vec<ShoppingListView>>> {
    let rows: Vec<ShoppingListView> = sqlx::query_as(
        "SELECT sl.id, sl.name, sl.owner_kind, sl.owner_id, sl.target_household_id,
                sl.created_by_person_id, sl.created_at
         FROM shopping_list sl
         WHERE (sl.owner_kind = 'budget' AND sl.owner_id IN (
                    SELECT id FROM budget WHERE person_id = ?
               ))
            OR (sl.owner_kind = 'fund' AND sl.owner_id IN (
                    SELECT fund_id FROM fund_participant WHERE person_id = ?
               ))
         ORDER BY sl.created_at DESC",
    )
    .bind(&user.person_id)
    .bind(&user.person_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_shopping_list(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateListRequest>,
) -> ApiResult<Json<ShoppingListView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    if !matches!(body.owner_kind.as_str(), "budget" | "fund") {
        return Err(ApiError::BadRequest(
            "owner_kind must be budget or fund".into(),
        ));
    }
    let stub = ShoppingListView {
        id: String::new(),
        name: name.clone(),
        owner_kind: body.owner_kind.clone(),
        owner_id: body.owner_id.clone(),
        target_household_id: body.target_household_id.clone(),
        created_by_person_id: user.person_id.clone(),
        created_at: String::new(),
    };
    assert_list_access(&state, &stub, &user.person_id).await?;

    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO shopping_list (id, name, owner_kind, owner_id, target_household_id, created_by_person_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&body.owner_kind)
    .bind(&body.owner_id)
    .bind(&body.target_household_id)
    .bind(&user.person_id)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "shopping_list", &id);
    Ok(Json(ShoppingListView {
        id,
        name,
        owner_kind: body.owner_kind,
        owner_id: body.owner_id,
        target_household_id: body.target_household_id,
        created_by_person_id: user.person_id,
        created_at: now,
    }))
}

async fn list_items(
    State(state): State<AppState>,
    user: AuthUser,
    Path(list_id): Path<String>,
) -> ApiResult<Json<Vec<ShoppingItemView>>> {
    let list = load_list(&state, &list_id).await?;
    assert_list_access(&state, &list, &user.person_id).await?;
    let rows: Vec<ShoppingItemView> = sqlx::query_as(
        "SELECT i.id, i.shopping_list_id, i.product_id, p.name AS product_name, i.status,
                i.quantity_needed, i.quantity_purchased, i.preferred_store_id,
                i.last_price_minor, i.last_price_currency, i.updated_at, i.created_at
         FROM shopping_item i
         JOIN product p ON p.id = i.product_id
         WHERE i.shopping_list_id = ?
         ORDER BY i.status, p.name COLLATE NOCASE",
    )
    .bind(&list_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn add_item(
    State(state): State<AppState>,
    user: AuthUser,
    Path(list_id): Path<String>,
    Json(body): Json<AddItemRequest>,
) -> ApiResult<Json<ShoppingItemView>> {
    let list = load_list(&state, &list_id).await?;
    assert_list_access(&state, &list, &user.person_id).await?;
    if body.quantity_needed <= 0.0 {
        return Err(ApiError::BadRequest("quantity_needed must be > 0".into()));
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
        "INSERT INTO shopping_item (id, shopping_list_id, product_id, status, quantity_needed,
                                    quantity_purchased, preferred_store_id, updated_at, created_at)
         VALUES (?, ?, ?, 'needed', ?, 0, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&list_id)
    .bind(&body.product_id)
    .bind(body.quantity_needed)
    .bind(&body.preferred_store_id)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "shopping_item", &id);
    Ok(Json(ShoppingItemView {
        id,
        shopping_list_id: list_id,
        product_id: body.product_id,
        product_name,
        status: "needed".into(),
        quantity_needed: body.quantity_needed,
        quantity_purchased: 0.0,
        preferred_store_id: body.preferred_store_id,
        last_price_minor: None,
        last_price_currency: None,
        updated_at: now.clone(),
        created_at: now,
    }))
}

async fn set_in_cart(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<SetInCartRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let item: Option<(String, String)> =
        sqlx::query_as("SELECT shopping_list_id, status FROM shopping_item WHERE id = ?")
            .bind(&body.item_id)
            .fetch_optional(&state.pool)
            .await?;
    let Some((list_id, status)) = item else {
        return Err(ApiError::NotFound("Shopping Item not found".into()));
    };
    let list = load_list(&state, &list_id).await?;
    assert_list_access(&state, &list, &user.person_id).await?;
    if status == "purchased" {
        return Err(ApiError::BadRequest("item already purchased".into()));
    }
    let now = now_rfc3339();
    sqlx::query("UPDATE shopping_item SET status = 'in_cart', updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&body.item_id)
        .execute(&state.pool)
        .await?;
    state
        .events
        .publish("updated", "shopping_item", &body.item_id);
    Ok(Json(json!({ "id": body.item_id, "status": "in_cart" })))
}

async fn purchase_item(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PurchaseItemRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    if body.quantity <= 0.0 {
        return Err(ApiError::BadRequest("quantity must be > 0".into()));
    }
    let item: Option<(String, String, String, f64, f64, Option<String>)> = sqlx::query_as(
        "SELECT shopping_list_id, product_id, status, quantity_needed, quantity_purchased, preferred_store_id
         FROM shopping_item WHERE id = ?",
    )
    .bind(&body.item_id)
    .fetch_optional(&state.pool)
    .await?;
    let Some((list_id, product_id, _status, needed, purchased, preferred_store)) = item else {
        return Err(ApiError::NotFound("Shopping Item not found".into()));
    };
    let list = load_list(&state, &list_id).await?;
    assert_list_access(&state, &list, &user.person_id).await?;

    let remaining = needed - purchased;
    if body.quantity > remaining + 1e-9 {
        return Err(ApiError::BadRequest(format!(
            "quantity exceeds remaining needed ({remaining})"
        )));
    }

    let store_id = body.store_id.or(preferred_store);
    let mut price_minor: Option<i64> = None;
    let mut currency: Option<String> = None;

    // Prefer an explicit or Preferred Store; otherwise use the minimum known Store Price.
    let resolved_store = if store_id.is_some() {
        store_id.clone()
    } else {
        let cheapest: Option<(String,)> = sqlx::query_as(
            "SELECT store_id FROM store_price WHERE product_id = ?
             ORDER BY amount_minor ASC, store_id ASC LIMIT 1",
        )
        .bind(&product_id)
        .fetch_optional(&state.pool)
        .await?;
        cheapest.map(|(id,)| id)
    };

    if let Some(ref sid) = resolved_store {
        let price: Option<(i64, String)> = sqlx::query_as(
            "SELECT amount_minor, currency FROM store_price WHERE store_id = ? AND product_id = ? LIMIT 1",
        )
        .bind(sid)
        .bind(&product_id)
        .fetch_optional(&state.pool)
        .await?;
        if let Some((amount, cur)) = price {
            price_minor = Some(amount);
            currency = Some(cur);
        }
    }

    if price_minor.is_none() {
        let Some(price) = body.price else {
            return Err(ApiError::BadRequest(
                "price required when Store Price is unknown".into(),
            ));
        };
        if price < 0.0 {
            return Err(ApiError::BadRequest("price must be >= 0".into()));
        }
        price_minor = Some(to_minor(price));
        currency = Some(
            body.currency
                .unwrap_or_else(|| user.default_currency.clone())
                .to_uppercase(),
        );
    }

    let unit_price = price_minor.unwrap();
    let cur = currency.unwrap();
    let line_total = ((unit_price as f64) * body.quantity).round() as i64;
    let now = now_rfc3339();
    let new_purchased = purchased + body.quantity;
    let new_status = if new_purchased + 1e-9 >= needed {
        "purchased"
    } else {
        "in_cart"
    };

    tracing::info!(
        "Purchasing shopping item={} qty={} line_total={}",
        body.item_id,
        body.quantity,
        line_total
    );

    // Resolve target Household for Stock receipt (ADR-0040).
    let household_id = if let Some(ref hh) = list.target_household_id {
        Some(hh.clone())
    } else {
        sqlx::query_as::<_, (Option<String>,)>(
            "SELECT default_household_id FROM person WHERE id = ?",
        )
        .bind(&user.person_id)
        .fetch_one(&state.pool)
        .await?
        .0
    };

    if let Some(ref hh) = household_id {
        require_household_member(&state, hh, &user.person_id).await?;
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "UPDATE shopping_item SET quantity_purchased = ?, status = ?, last_price_minor = ?,
         last_price_currency = ?, updated_at = ? WHERE id = ?",
    )
    .bind(new_purchased)
    .bind(new_status)
    .bind(unit_price)
    .bind(&cur)
    .bind(&now)
    .bind(&body.item_id)
    .execute(&mut *tx)
    .await?;

    if let Some(ref hh) = household_id {
        let location: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM location WHERE household_id = ? ORDER BY
             CASE kind WHEN 'pantry' THEN 0 WHEN 'fridge' THEN 1 ELSE 2 END, name LIMIT 1",
        )
        .bind(hh)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some((location_id,)) = location {
            let entry_id = new_id();
            sqlx::query(
                "INSERT INTO stock_entry (id, household_id, location_id, product_id, quantity, expires_on, created_at)
                 VALUES (?, ?, ?, ?, ?, NULL, ?)",
            )
            .bind(&entry_id)
            .bind(hh)
            .bind(&location_id)
            .bind(&product_id)
            .bind(body.quantity)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
            state.events.publish("created", "stock_entry", &entry_id);
        }
    }

    match list.owner_kind.as_str() {
        "budget" => {
            let tx_id = new_id();
            sqlx::query(
                "INSERT INTO budget_transaction (id, budget_id, kind, amount_minor, currency, memo, created_at, idempotency_key)
                 VALUES (?, ?, 'expense', ?, ?, ?, ?, ?)",
            )
            .bind(&tx_id)
            .bind(&list.owner_id)
            .bind(-line_total)
            .bind(&cur)
            .bind(format!("purchase:{}", body.item_id))
            .bind(&now)
            .bind(&body.idempotency_key)
            .execute(&mut *tx)
            .await
            .map_err(|err| {
                if let sqlx::Error::Database(db) = &err
                    && db.message().contains("UNIQUE")
                {
                    return ApiError::Conflict("idempotency key already used".into());
                }
                ApiError::Database(err)
            })?;
            state
                .events
                .publish("created", "budget_transaction", &tx_id);
        }
        "fund" => {
            let participants: Vec<(String,)> =
                sqlx::query_as("SELECT person_id FROM fund_participant WHERE fund_id = ?")
                    .bind(&list.owner_id)
                    .fetch_all(&mut *tx)
                    .await?;
            let n = participants.len().max(1) as i64;
            let mut deltas = HashMap::new();
            deltas.insert(user.person_id.clone(), line_total);
            let mut allocated = 0i64;
            for (i, (pid,)) in participants.iter().enumerate() {
                let share = if i + 1 == participants.len() {
                    line_total - allocated
                } else {
                    line_total / n
                };
                allocated += share;
                *deltas.entry(pid.clone()).or_insert(0) -= share;
            }
            let existing: Option<(String,)> = sqlx::query_as(
                "SELECT id FROM accounting_entry WHERE fund_id = ? AND idempotency_key = ?",
            )
            .bind(&list.owner_id)
            .bind(&body.idempotency_key)
            .fetch_optional(&mut *tx)
            .await?;
            if existing.is_none() {
                let entry_id = new_id();
                let deltas_json = serde_json::to_string(&deltas).unwrap_or_else(|_| "{}".into());
                sqlx::query(
                    "INSERT INTO accounting_entry (id, fund_id, source_command, idempotency_key, deltas_json, created_at)
                     VALUES (?, ?, 'shopping.purchase', ?, ?, ?)",
                )
                .bind(&entry_id)
                .bind(&list.owner_id)
                .bind(&body.idempotency_key)
                .bind(&deltas_json)
                .bind(&now)
                .execute(&mut *tx)
                .await?;
                state
                    .events
                    .publish("created", "accounting_entry", &entry_id);
            }
        }
        _ => {}
    }

    tx.commit().await?;
    tracing::info!("Purchased shopping item={}", body.item_id);
    state
        .events
        .publish("updated", "shopping_item", &body.item_id);

    Ok(Json(json!({
        "id": body.item_id,
        "status": new_status,
        "quantity_purchased": new_purchased,
        "line_total_minor": line_total,
        "currency": cur,
        "unit_price_minor": unit_price,
    })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/shopping-lists",
            get(list_shopping_lists).post(create_shopping_list),
        )
        .route(
            "/api/v1/shopping-lists/{list_id}/items",
            get(list_items).post(add_item),
        )
        .route("/api/v1/commands/shopping/set-in-cart", post(set_in_cart))
        .route("/api/v1/commands/shopping/purchase", post(purchase_item))
}
