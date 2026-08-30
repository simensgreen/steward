//! Money: Budget, Fund, Accounting Entries, Transfer command (ADR-0003, ADR-0007, ADR-0034, ADR-0044).

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sqlx::FromRow;
use std::collections::HashMap;

use crate::AppState;
use crate::auth::AuthUser;
use crate::error::{ApiError, ApiResult};
use crate::util::{from_minor, new_id, now_rfc3339, to_minor};

#[derive(Debug, FromRow, Serialize)]
pub struct BudgetView {
    pub id: String,
    pub person_id: String,
    pub currency: String,
    pub created_at: String,
}

#[derive(Debug, FromRow, Serialize)]
pub struct BudgetTransactionView {
    pub id: String,
    pub budget_id: String,
    pub kind: String,
    pub amount_minor: i64,
    pub currency: String,
    pub fx_to_budget: Option<f64>,
    pub memo: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateBudgetTxRequest {
    pub kind: String,
    pub amount: f64,
    pub currency: Option<String>,
    pub memo: Option<String>,
    pub idempotency_key: Option<String>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct FundView {
    pub id: String,
    pub name: String,
    pub default_currency: String,
    pub settlement_strategy: String,
    pub household_id: Option<String>,
    pub owner_person_id: String,
    pub created_at: String,
    pub role: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateFundRequest {
    pub name: String,
    pub default_currency: Option<String>,
    pub settlement_strategy: Option<String>,
    pub household_id: Option<String>,
}

#[derive(Deserialize)]
pub struct AddFundParticipantRequest {
    pub username: String,
    pub role: Option<String>,
}

#[derive(Serialize)]
pub struct MemberBalanceView {
    pub person_id: String,
    pub display_name: String,
    pub balance_minor: i64,
    pub balance: f64,
}

#[derive(Deserialize)]
pub struct FundExpenseRequest {
    pub fund_id: String,
    pub payer_person_id: String,
    pub amount: f64,
    pub memo: Option<String>,
    pub idempotency_key: String,
    /// Optional custom share weights keyed by person_id; default equal shares.
    pub shares: Option<HashMap<String, f64>>,
}

#[derive(Deserialize)]
pub struct FundTransferRequest {
    pub fund_id: String,
    pub from_person_id: String,
    pub to_person_id: String,
    pub amount: f64,
    pub memo: Option<String>,
    pub idempotency_key: String,
}

async fn require_fund_participant(
    state: &AppState,
    fund_id: &str,
    person_id: &str,
) -> ApiResult<String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT role FROM fund_participant WHERE fund_id = ? AND person_id = ?")
            .bind(fund_id)
            .bind(person_id)
            .fetch_optional(&state.pool)
            .await?;
    row.map(|r| r.0)
        .ok_or_else(|| ApiError::Forbidden("not a Fund participant".into()))
}

pub async fn derived_balances(state: &AppState, fund_id: &str) -> ApiResult<HashMap<String, i64>> {
    let revision: Option<(String,)> = sqlx::query_as(
        "SELECT balances_json FROM fund_revision WHERE fund_id = ? ORDER BY revision_number DESC LIMIT 1",
    )
    .bind(fund_id)
    .fetch_optional(&state.pool)
    .await?;

    let mut balances: HashMap<String, i64> = if let Some((json,)) = revision {
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        HashMap::new()
    };

    let entries: Vec<(String,)> = sqlx::query_as(
        "SELECT deltas_json FROM accounting_entry WHERE fund_id = ? ORDER BY created_at, id",
    )
    .bind(fund_id)
    .fetch_all(&state.pool)
    .await?;

    for (deltas_json,) in entries {
        let deltas: HashMap<String, i64> = serde_json::from_str(&deltas_json).unwrap_or_default();
        for (person_id, delta) in deltas {
            *balances.entry(person_id).or_insert(0) += delta;
        }
    }
    Ok(balances)
}

async fn get_my_budget(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<BudgetView>> {
    let row: BudgetView = sqlx::query_as(
        "SELECT id, person_id, currency, created_at FROM budget WHERE person_id = ?",
    )
    .bind(&user.person_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("Budget not found".into()))?;
    Ok(Json(row))
}

async fn list_budget_transactions(
    State(state): State<AppState>,
    user: AuthUser,
    Path(budget_id): Path<String>,
) -> ApiResult<Json<Vec<BudgetTransactionView>>> {
    let budget: Option<(String,)> =
        sqlx::query_as("SELECT id FROM budget WHERE id = ? AND person_id = ?")
            .bind(&budget_id)
            .bind(&user.person_id)
            .fetch_optional(&state.pool)
            .await?;
    if budget.is_none() {
        return Err(ApiError::Forbidden("Budget not owned by you".into()));
    }
    let rows: Vec<BudgetTransactionView> = sqlx::query_as(
        "SELECT id, budget_id, kind, amount_minor, currency, fx_to_budget, memo, created_at
         FROM budget_transaction WHERE budget_id = ? ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&budget_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_budget_transaction(
    State(state): State<AppState>,
    user: AuthUser,
    Path(budget_id): Path<String>,
    Json(body): Json<CreateBudgetTxRequest>,
) -> ApiResult<Json<BudgetTransactionView>> {
    let budget: Option<(String,)> =
        sqlx::query_as("SELECT currency FROM budget WHERE id = ? AND person_id = ?")
            .bind(&budget_id)
            .bind(&user.person_id)
            .fetch_optional(&state.pool)
            .await?;
    let Some((budget_currency,)) = budget else {
        return Err(ApiError::Forbidden("Budget not owned by you".into()));
    };
    if !matches!(body.kind.as_str(), "expense" | "income" | "transfer") {
        return Err(ApiError::BadRequest("invalid transaction kind".into()));
    }
    if body.amount == 0.0 {
        return Err(ApiError::BadRequest("amount must be non-zero".into()));
    }
    let currency = body.currency.unwrap_or(budget_currency).to_uppercase();
    let amount_minor = to_minor(body.amount.abs());
    let signed = if body.kind == "expense" {
        -amount_minor
    } else {
        amount_minor
    };
    let id = new_id();
    let now = now_rfc3339();
    sqlx::query(
        "INSERT INTO budget_transaction (id, budget_id, kind, amount_minor, currency, memo, created_at, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&budget_id)
    .bind(&body.kind)
    .bind(signed)
    .bind(&currency)
    .bind(&body.memo)
    .bind(&now)
    .bind(&body.idempotency_key)
    .execute(&state.pool)
    .await
    .map_err(|err| {
        if let sqlx::Error::Database(db) = &err
            && db.message().contains("UNIQUE")
        {
            return ApiError::Conflict("idempotency key already used".into());
        }
        ApiError::Database(err)
    })?;
    state.events.publish("created", "budget_transaction", &id);
    Ok(Json(BudgetTransactionView {
        id,
        budget_id,
        kind: body.kind,
        amount_minor: signed,
        currency,
        fx_to_budget: None,
        memo: body.memo,
        created_at: now,
    }))
}

async fn list_funds(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<Vec<FundView>>> {
    let rows: Vec<FundView> = sqlx::query_as(
        "SELECT f.id, f.name, f.default_currency, f.settlement_strategy, f.household_id,
                f.owner_person_id, f.created_at, p.role AS role
         FROM fund f
         JOIN fund_participant p ON p.fund_id = f.id
         WHERE p.person_id = ?
         ORDER BY f.name COLLATE NOCASE",
    )
    .bind(&user.person_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

async fn create_fund(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<CreateFundRequest>,
) -> ApiResult<Json<FundView>> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name required".into()));
    }
    let strategy = body
        .settlement_strategy
        .unwrap_or_else(|| "equal_shares".into());
    if !matches!(
        strategy.as_str(),
        "equal_shares" | "one_payer" | "custom_shares"
    ) {
        return Err(ApiError::BadRequest("invalid settlement strategy".into()));
    }
    let currency = body
        .default_currency
        .unwrap_or_else(|| user.default_currency.clone())
        .to_uppercase();
    let id = new_id();
    let revision_id = new_id();
    let now = now_rfc3339();
    tracing::info!("Creating Fund id={id}");

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO fund (id, name, default_currency, settlement_strategy, household_id, owner_person_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&currency)
    .bind(&strategy)
    .bind(&body.household_id)
    .bind(&user.person_id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO fund_participant (fund_id, person_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    )
    .bind(&id)
    .bind(&user.person_id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;
    let balances = json!({ user.person_id.clone(): 0 });
    sqlx::query(
        "INSERT INTO fund_revision (id, fund_id, revision_number, balances_json, created_at)
         VALUES (?, ?, 0, ?, ?)",
    )
    .bind(&revision_id)
    .bind(&id)
    .bind(balances.to_string())
    .bind(&now)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    tracing::info!("Created Fund id={id}");
    state.events.publish("created", "fund", &id);
    Ok(Json(FundView {
        id,
        name,
        default_currency: currency,
        settlement_strategy: strategy,
        household_id: body.household_id,
        owner_person_id: user.person_id,
        created_at: now,
        role: Some("owner".into()),
    }))
}

async fn add_fund_participant(
    State(state): State<AppState>,
    user: AuthUser,
    Path(fund_id): Path<String>,
    Json(body): Json<AddFundParticipantRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let role = require_fund_participant(&state, &fund_id, &user.person_id).await?;
    if role != "owner" {
        return Err(ApiError::Forbidden(
            "only Owner can add participants".into(),
        ));
    }
    let member_role = body.role.unwrap_or_else(|| "member".into());
    let person: Option<(String, String)> =
        sqlx::query_as("SELECT id, display_name FROM person WHERE username = ? COLLATE NOCASE")
            .bind(body.username.trim())
            .fetch_optional(&state.pool)
            .await?;
    let Some((person_id, display_name)) = person else {
        return Err(ApiError::NotFound("Person not found".into()));
    };
    let now = now_rfc3339();
    let result = sqlx::query(
        "INSERT OR IGNORE INTO fund_participant (fund_id, person_id, role, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&fund_id)
    .bind(&person_id)
    .bind(&member_role)
    .bind(&now)
    .execute(&state.pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::Conflict("already a participant".into()));
    }
    state.events.publish("updated", "fund", &fund_id);
    Ok(Json(json!({
        "person_id": person_id,
        "display_name": display_name,
        "role": member_role,
    })))
}

async fn fund_balances(
    State(state): State<AppState>,
    user: AuthUser,
    Path(fund_id): Path<String>,
) -> ApiResult<Json<Vec<MemberBalanceView>>> {
    require_fund_participant(&state, &fund_id, &user.person_id).await?;
    let balances = derived_balances(&state, &fund_id).await?;
    let participants: Vec<(String, String)> = sqlx::query_as(
        "SELECT p.id, p.display_name FROM fund_participant fp
         JOIN person p ON p.id = fp.person_id WHERE fp.fund_id = ?",
    )
    .bind(&fund_id)
    .fetch_all(&state.pool)
    .await?;
    let views = participants
        .into_iter()
        .map(|(person_id, display_name)| {
            let balance_minor = *balances.get(&person_id).unwrap_or(&0);
            MemberBalanceView {
                person_id,
                display_name,
                balance_minor,
                balance: from_minor(balance_minor),
            }
        })
        .collect();
    Ok(Json(views))
}

async fn post_accounting_entry(
    state: &AppState,
    fund_id: &str,
    source_command: &str,
    idempotency_key: &str,
    deltas: HashMap<String, i64>,
) -> ApiResult<String> {
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM accounting_entry WHERE fund_id = ? AND idempotency_key = ?")
            .bind(fund_id)
            .bind(idempotency_key)
            .fetch_optional(&state.pool)
            .await?;
    if let Some((id,)) = existing {
        return Ok(id);
    }
    let id = new_id();
    let now = now_rfc3339();
    let mut map = Map::new();
    for (k, v) in &deltas {
        map.insert(k.clone(), Value::from(*v));
    }
    sqlx::query(
        "INSERT INTO accounting_entry (id, fund_id, source_command, idempotency_key, deltas_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(fund_id)
    .bind(source_command)
    .bind(idempotency_key)
    .bind(Value::Object(map).to_string())
    .bind(&now)
    .execute(&state.pool)
    .await?;
    state.events.publish("created", "accounting_entry", &id);
    Ok(id)
}

async fn fund_expense(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<FundExpenseRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    require_fund_participant(&state, &body.fund_id, &user.person_id).await?;
    require_fund_participant(&state, &body.fund_id, &body.payer_person_id).await?;
    if body.amount <= 0.0 {
        return Err(ApiError::BadRequest("amount must be > 0".into()));
    }
    let amount_minor = to_minor(body.amount);
    let participants: Vec<(String,)> =
        sqlx::query_as("SELECT person_id FROM fund_participant WHERE fund_id = ?")
            .bind(&body.fund_id)
            .fetch_all(&state.pool)
            .await?;
    if participants.is_empty() {
        return Err(ApiError::BadRequest("Fund has no participants".into()));
    }

    let mut deltas: HashMap<String, i64> = HashMap::new();
    deltas.insert(body.payer_person_id.clone(), amount_minor);

    let share_targets: Vec<(String, f64)> = if let Some(ref shares) = body.shares {
        shares.iter().map(|(k, v)| (k.clone(), *v)).collect()
    } else {
        participants.iter().map(|(id,)| (id.clone(), 1.0)).collect()
    };
    let weight_sum: f64 = share_targets.iter().map(|(_, w)| *w).sum();
    if weight_sum <= 0.0 {
        return Err(ApiError::BadRequest("share weights must sum > 0".into()));
    }
    let mut allocated = 0i64;
    for (i, (person_id, weight)) in share_targets.iter().enumerate() {
        let share = if i + 1 == share_targets.len() {
            amount_minor - allocated
        } else {
            ((amount_minor as f64) * (weight / weight_sum)).round() as i64
        };
        allocated += share;
        *deltas.entry(person_id.clone()).or_insert(0) -= share;
    }

    tracing::info!(
        "Posting Fund expense fund={} amount_minor={}",
        body.fund_id,
        amount_minor
    );
    let entry_id = post_accounting_entry(
        &state,
        &body.fund_id,
        "fund.expense",
        &body.idempotency_key,
        deltas.clone(),
    )
    .await?;
    tracing::info!("Posted Fund expense entry={entry_id}");
    Ok(Json(json!({
        "accounting_entry_id": entry_id,
        "deltas": deltas,
        "memo": body.memo,
    })))
}

async fn fund_transfer(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<FundTransferRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    require_fund_participant(&state, &body.fund_id, &user.person_id).await?;
    require_fund_participant(&state, &body.fund_id, &body.from_person_id).await?;
    require_fund_participant(&state, &body.fund_id, &body.to_person_id).await?;
    if body.amount <= 0.0 {
        return Err(ApiError::BadRequest("amount must be > 0".into()));
    }
    if body.from_person_id == body.to_person_id {
        return Err(ApiError::BadRequest("cannot transfer to self".into()));
    }
    let amount_minor = to_minor(body.amount);
    let mut deltas = HashMap::new();
    // Paying reduces the payer's positive balance claim / increases what they owe less.
    // from pays to: from balance decreases (they settle debt or gift), to increases.
    deltas.insert(body.from_person_id.clone(), -amount_minor);
    deltas.insert(body.to_person_id.clone(), amount_minor);

    tracing::info!(
        "Posting Fund transfer fund={} amount_minor={}",
        body.fund_id,
        amount_minor
    );
    let entry_id = post_accounting_entry(
        &state,
        &body.fund_id,
        "fund.transfer",
        &body.idempotency_key,
        deltas.clone(),
    )
    .await?;
    tracing::info!("Posted Fund transfer entry={entry_id}");
    Ok(Json(json!({
        "accounting_entry_id": entry_id,
        "deltas": deltas,
        "memo": body.memo,
    })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/budgets/me", get(get_my_budget))
        .route(
            "/api/v1/budgets/{budget_id}/transactions",
            get(list_budget_transactions).post(create_budget_transaction),
        )
        .route("/api/v1/funds", get(list_funds).post(create_fund))
        .route(
            "/api/v1/funds/{fund_id}/participants",
            post(add_fund_participant),
        )
        .route("/api/v1/funds/{fund_id}/balances", get(fund_balances))
        .route("/api/v1/commands/fund/expense", post(fund_expense))
        .route("/api/v1/commands/fund/transfer", post(fund_transfer))
}
