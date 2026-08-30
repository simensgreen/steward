//! Steward HTTP API server library.

pub mod auth;
pub mod calendar;
pub mod catalog;
pub mod config;
pub mod household;
pub mod money;
pub mod shopping;
pub mod stock;
pub mod sync;

use axum::Router;
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::config::Config;

/// Shared application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
}

/// Open the database pool and run migrations.
pub async fn connect_db(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    info!("Opening database connection");
    if let Some(path) = database_url
        .strip_prefix("sqlite:")
        .and_then(|rest| rest.split('?').next())
    {
        if let Some(parent) = std::path::Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent).map_err(sqlx::Error::Io)?;
            }
        }
    }
    let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;
    info!("Running database migrations");
    sqlx::migrate!("./migrations").run(&pool).await?;
    info!("Database ready");
    Ok(pool)
}

/// Build the HTTP router.
pub fn app_router(state: AppState) -> Router {
    Router::new()
        .merge(sync::router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Run the server until shutdown.
pub async fn run(config: Config) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let pool = connect_db(&config.database_url).await?;
    let state = AppState { pool };
    let app = app_router(state);
    let listener = tokio::net::TcpListener::bind(&config.bind).await?;
    info!("HTTP server listening on {}", config.bind);
    axum::serve(listener, app).await?;
    info!("HTTP server stopped");
    Ok(())
}
