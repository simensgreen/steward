//! Catalog: Product, Store, Store Price, Recipe (instance-global).

use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;
use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::util::{new_id, now_rfc3339, to_minor};

#[derive(Debug, FromRow, Serialize)]
pub struct ProductView {
    pub id: String,
    pub name: String,
    pub barcode: Option<String>,
    pub purchase_unit: String,
    pub consumption_unit: String,
    pub unit_conversion: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateProductRequest {
    pub name: String,
    pub barcode: Option<String>,
    pub purchase_unit: Option<String>,
    pub consumption_unit: Option<String>,
    pub unit_conversion: Option<f64>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct StoreView {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateStoreRequest {
    pub name: String,
}

#[derive(Debug, FromRow, Serialize)]
pub struct StorePriceView {
    pub id: String,
    pub store_id: String,
    pub product_id: String,
    pub currency: String,
    pub amount_minor: i64,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct UpsertPriceRequest {
    pub product_id: String,
    pub currency: String,
    pub amount: f64,
}

#[derive(Debug, FromRow, Serialize)]
pub struct RecipeView {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateRecipeRequest {
    pub name: String,
    pub ingredients: Vec<RecipeIngredientInput>,
}

#[derive(Deserialize)]
pub struct RecipeIngredientInput {
    pub product_id: String,
    pub quantity: f64,
}

#[derive(Debug, FromRow, Serialize)]
pub struct RecipeIngredientView {
    pub product_id: String,
    pub product_name: String,
    pub quantity: f64,
}

async fn list_products(
    State(state): State<AppState>,
    _user: AuthUser,
) -> ApiResult<Json<Vec<ProductView>>> {
    let rows: Vec<ProductView> = sqlx::query_as(
        "SELECT id, name, barcode, purchase_unit, consumption_unit, unit_conversion, created_at, updated_at
         FROM product ORDER BY name COLLATE NOCASE",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_product(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(body): Json<CreateProductRequest>,
) -> ApiResult<Json<ProductView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    let purchase_unit = body.purchase_unit.unwrap_or_else(|| "pcs".into());
    let consumption_unit = body
        .consumption_unit
        .unwrap_or_else(|| purchase_unit.clone());
    let unit_conversion = body.unit_conversion.unwrap_or(1.0);
    sqlx::query(
        "INSERT INTO product (id, name, barcode, purchase_unit, consumption_unit, unit_conversion, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&body.barcode)
    .bind(&purchase_unit)
    .bind(&consumption_unit)
    .bind(unit_conversion)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "product", &id);
    Ok(Json(ProductView {
        id,
        name,
        barcode: body.barcode,
        purchase_unit,
        consumption_unit,
        unit_conversion,
        created_at: now.clone(),
        updated_at: now,
    }))
}

async fn list_stores(
    State(state): State<AppState>,
    _user: AuthUser,
) -> ApiResult<Json<Vec<StoreView>>> {
    let rows: Vec<StoreView> =
        sqlx::query_as("SELECT id, name, created_at FROM store ORDER BY name COLLATE NOCASE")
            .fetch_all(&state.pool)
            .await?;
    Ok(Json(rows))
}

async fn create_store(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(body): Json<CreateStoreRequest>,
) -> ApiResult<Json<StoreView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query("INSERT INTO store (id, name, created_at) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&now)
        .execute(&state.pool)
        .await?;
    state.events.publish("created", "store", &id);
    Ok(Json(StoreView {
        id,
        name,
        created_at: now,
    }))
}

async fn list_prices(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(store_id): Path<String>,
) -> ApiResult<Json<Vec<StorePriceView>>> {
    let rows: Vec<StorePriceView> = sqlx::query_as(
        "SELECT id, store_id, product_id, currency, amount_minor, updated_at
         FROM store_price WHERE store_id = ?",
    )
    .bind(&store_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn upsert_price(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(store_id): Path<String>,
    Json(body): Json<UpsertPriceRequest>,
) -> ApiResult<Json<StorePriceView>> {
    if body.amount < 0.0 {
        return Err(ApiError::BadRequest("amount must be >= 0".into()));
    }
    let currency = body.currency.to_uppercase();
    let amount_minor = to_minor(body.amount);
    let now = now_rfc3339();
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM store_price WHERE store_id = ? AND product_id = ? AND currency = ?",
    )
    .bind(&store_id)
    .bind(&body.product_id)
    .bind(&currency)
    .fetch_optional(&state.pool)
    .await?;

    let id = if let Some((id,)) = existing {
        sqlx::query("UPDATE store_price SET amount_minor = ?, updated_at = ? WHERE id = ?")
            .bind(amount_minor)
            .bind(&now)
            .bind(&id)
            .execute(&state.pool)
            .await?;
        id
    } else {
        let id = new_id();
        sqlx::query(
            "INSERT INTO store_price (id, store_id, product_id, currency, amount_minor, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&store_id)
        .bind(&body.product_id)
        .bind(&currency)
        .bind(amount_minor)
        .bind(&now)
        .execute(&state.pool)
        .await?;
        id
    };
    state.events.publish("updated", "store_price", &id);
    Ok(Json(StorePriceView {
        id,
        store_id,
        product_id: body.product_id,
        currency,
        amount_minor,
        updated_at: now,
    }))
}

async fn list_recipes(
    State(state): State<AppState>,
    _user: AuthUser,
) -> ApiResult<Json<Vec<RecipeView>>> {
    let rows: Vec<RecipeView> = sqlx::query_as(
        "SELECT id, name, created_at, updated_at FROM recipe ORDER BY name COLLATE NOCASE",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_recipe(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(body): Json<CreateRecipeRequest>,
) -> ApiResult<Json<RecipeView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let id = new_id();
    let now = now_rfc3339();
    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO recipe (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    for ingredient in &body.ingredients {
        if ingredient.quantity <= 0.0 {
            return Err(ApiError::BadRequest(
                "ingredient quantity must be > 0".into(),
            ));
        }
        sqlx::query(
            "INSERT INTO recipe_ingredient (recipe_id, product_id, quantity) VALUES (?, ?, ?)",
        )
        .bind(&id)
        .bind(&ingredient.product_id)
        .bind(ingredient.quantity)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    state.events.publish("created", "recipe", &id);
    Ok(Json(RecipeView {
        id,
        name,
        created_at: now.clone(),
        updated_at: now,
    }))
}

async fn recipe_ingredients(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<RecipeIngredientView>>> {
    let rows: Vec<RecipeIngredientView> = sqlx::query_as(
        "SELECT ri.product_id, p.name AS product_name, ri.quantity
         FROM recipe_ingredient ri
         JOIN product p ON p.id = ri.product_id
         WHERE ri.recipe_id = ?",
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/products", get(list_products).post(create_product))
        .route("/api/v1/stores", get(list_stores).post(create_store))
        .route(
            "/api/v1/stores/{store_id}/prices",
            get(list_prices).post(upsert_price),
        )
        .route("/api/v1/recipes", get(list_recipes).post(create_recipe))
        .route("/api/v1/recipes/{id}/ingredients", get(recipe_ingredients))
}
