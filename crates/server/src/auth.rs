//! Auth: local accounts and bearer sessions (ADR-0027). Passkeys can extend this module later.

use axum::extract::FromRequestParts;
use axum::extract::State;
use axum::http::request::Parts;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;

use crate::AppState;
use crate::error::{ApiError, ApiResult};
use crate::util::{new_id, now_rfc3339, parse_rfc3339};

const SESSION_TTL_HOURS: i64 = 24 * 30;

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub person_id: String,
    pub username: String,
    pub display_name: String,
    pub default_currency: String,
    pub default_household_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct PersonRow {
    id: String,
    username: String,
    password_hash: String,
    display_name: String,
    default_currency: String,
    default_household_id: Option<String>,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub display_name: Option<String>,
    pub default_currency: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub person: PersonView,
}

#[derive(Serialize)]
pub struct PersonView {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub default_currency: String,
    pub default_household_id: Option<String>,
}

impl From<PersonRow> for PersonView {
    fn from(row: PersonRow) -> Self {
        Self {
            id: row.id,
            username: row.username,
            display_name: row.display_name,
            default_currency: row.default_currency,
            default_household_id: row.default_household_id,
        }
    }
}

fn hash_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    hex::encode(digest)
}

fn hash_password(password: &str) -> ApiResult<String> {
    use argon2::Argon2;
    use argon2::password_hash::PasswordHasher;

    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes())
        .map(|h| h.to_string())
        .map_err(|err| ApiError::Internal(format!("password hash failed: {err}")))
}

fn verify_password(password: &str, password_hash: &str) -> ApiResult<bool> {
    use argon2::Argon2;
    use argon2::password_hash::{PasswordVerifier, phc::PasswordHash};

    let parsed = PasswordHash::new(password_hash)
        .map_err(|err| ApiError::Internal(format!("invalid password hash: {err}")))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

fn make_session_token() -> String {
    let mut bytes = [0u8; 32];
    rand::fill(&mut bytes);
    hex::encode(bytes)
}

async fn create_session(state: &AppState, person_id: &str) -> ApiResult<String> {
    let token = make_session_token();
    let token_hash = hash_token(&token);
    let now = chrono::Utc::now();
    let expires = now + chrono::Duration::hours(SESSION_TTL_HOURS);
    sqlx::query(
        "INSERT INTO session (token_hash, person_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&token_hash)
    .bind(person_id)
    .bind(now.to_rfc3339())
    .bind(expires.to_rfc3339())
    .execute(&state.pool)
    .await?;
    Ok(token)
}

pub async fn person_from_token(state: &AppState, token: &str) -> ApiResult<AuthUser> {
    let token_hash = hash_token(token);
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT person_id, expires_at FROM session WHERE token_hash = ?")
            .bind(&token_hash)
            .fetch_optional(&state.pool)
            .await?;
    let Some((person_id, expires_at)) = row else {
        return Err(ApiError::Unauthorized("invalid session".into()));
    };
    let Some(expires) = parse_rfc3339(&expires_at) else {
        return Err(ApiError::Unauthorized("invalid session expiry".into()));
    };
    if expires < chrono::Utc::now() {
        let _ = sqlx::query("DELETE FROM session WHERE token_hash = ?")
            .bind(&token_hash)
            .execute(&state.pool)
            .await;
        return Err(ApiError::Unauthorized("session expired".into()));
    }
    let person: PersonRow = sqlx::query_as(
        "SELECT id, username, password_hash, display_name, default_currency, default_household_id
         FROM person WHERE id = ?",
    )
    .bind(&person_id)
    .fetch_one(&state.pool)
    .await?;
    Ok(AuthUser {
        person_id: person.id,
        username: person.username,
        display_name: person.display_name,
        default_currency: person.default_currency,
        default_household_id: person.default_household_id,
    })
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| ApiError::Unauthorized("missing Authorization header".into()))?;
        let token = header
            .strip_prefix("Bearer ")
            .ok_or_else(|| ApiError::Unauthorized("expected Bearer token".into()))?;
        person_from_token(state, token).await
    }
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> ApiResult<Json<AuthResponse>> {
    let username = body.username.trim().to_string();
    if username.is_empty() || body.password.len() < 8 {
        return Err(ApiError::BadRequest(
            "username required and password must be at least 8 characters".into(),
        ));
    }
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM person WHERE username = ? COLLATE NOCASE")
            .bind(&username)
            .fetch_optional(&state.pool)
            .await?;
    if existing.is_some() {
        return Err(ApiError::Conflict("username already taken".into()));
    }

    tracing::info!("Registering person username={username}");
    let person_id = new_id();
    let budget_id = new_id();
    let now = now_rfc3339();
    let display_name = body
        .display_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| username.clone());
    let currency = body
        .default_currency
        .filter(|s| s.len() == 3)
        .unwrap_or_else(|| "USD".into())
        .to_uppercase();
    let password_hash = hash_password(&body.password)?;

    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO person (id, username, password_hash, display_name, default_currency, created_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&person_id)
    .bind(&username)
    .bind(&password_hash)
    .bind(&display_name)
    .bind(&currency)
    .bind(&now)
    .execute(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO budget (id, person_id, currency, created_at) VALUES (?, ?, ?, ?)")
        .bind(&budget_id)
        .bind(&person_id)
        .bind(&currency)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    tracing::info!("Registered person id={person_id}");

    let token = create_session(&state, &person_id).await?;
    state.events.publish("created", "person", &person_id);
    Ok(Json(AuthResponse {
        token,
        person: PersonView {
            id: person_id,
            username,
            display_name,
            default_currency: currency,
            default_household_id: None,
        },
    }))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> ApiResult<Json<AuthResponse>> {
    let person: Option<PersonRow> = sqlx::query_as(
        "SELECT id, username, password_hash, display_name, default_currency, default_household_id
         FROM person WHERE username = ? COLLATE NOCASE",
    )
    .bind(body.username.trim())
    .fetch_optional(&state.pool)
    .await?;
    let Some(person) = person else {
        return Err(ApiError::Unauthorized("invalid credentials".into()));
    };
    if !verify_password(&body.password, &person.password_hash)? {
        return Err(ApiError::Unauthorized("invalid credentials".into()));
    }
    let token = create_session(&state, &person.id).await?;
    Ok(Json(AuthResponse {
        token,
        person: person.into(),
    }))
}

async fn logout(
    State(state): State<AppState>,
    user: AuthUser,
    headers: axum::http::HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    if let Some(header) = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        && let Some(token) = header.strip_prefix("Bearer ")
    {
        let token_hash = hash_token(token);
        sqlx::query("DELETE FROM session WHERE token_hash = ?")
            .bind(&token_hash)
            .execute(&state.pool)
            .await?;
    }
    let _ = user;
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn me(user: AuthUser) -> Json<PersonView> {
    Json(PersonView {
        id: user.person_id,
        username: user.username,
        display_name: user.display_name,
        default_currency: user.default_currency,
        default_household_id: user.default_household_id,
    })
}

#[derive(Deserialize)]
pub struct PatchMeRequest {
    pub display_name: Option<String>,
    pub default_currency: Option<String>,
    pub default_household_id: Option<String>,
}

async fn patch_me(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<PatchMeRequest>,
) -> ApiResult<Json<PersonView>> {
    let display_name = body
        .display_name
        .unwrap_or_else(|| user.display_name.clone());
    let default_currency = body
        .default_currency
        .map(|c| c.to_uppercase())
        .unwrap_or_else(|| user.default_currency.clone());
    let default_household_id = body
        .default_household_id
        .or(user.default_household_id.clone());

    if let Some(ref hh) = default_household_id {
        let member: Option<(String,)> = sqlx::query_as(
            "SELECT person_id FROM household_member WHERE household_id = ? AND person_id = ?",
        )
        .bind(hh)
        .bind(&user.person_id)
        .fetch_optional(&state.pool)
        .await?;
        if member.is_none() {
            return Err(ApiError::Forbidden("not a member of that Household".into()));
        }
    }

    sqlx::query(
        "UPDATE person SET display_name = ?, default_currency = ?, default_household_id = ? WHERE id = ?",
    )
    .bind(&display_name)
    .bind(&default_currency)
    .bind(&default_household_id)
    .bind(&user.person_id)
    .execute(&state.pool)
    .await?;

    state.events.publish("updated", "person", &user.person_id);
    Ok(Json(PersonView {
        id: user.person_id,
        username: user.username,
        display_name,
        default_currency,
        default_household_id,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/register", post(register))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/me", get(me).patch(patch_me))
}
