//! Health and SSE sync endpoints (ADR-0028).

use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::routing::get;
use axum::{Json, Router};
use futures_util::stream::{self, Stream};
use serde::Serialize;
use std::convert::Infallible;
use std::time::Duration;
use tokio_stream::StreamExt as _;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn events(
    State(_state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let connected =
        stream::once(async { Ok(Event::default().event("connected").data(r#"{"ok":true}"#)) });
    let heartbeat = stream::unfold((), |()| async {
        tokio::time::sleep(Duration::from_secs(15)).await;
        Some((
            Ok(Event::default().event("heartbeat").data(r#"{"ts":"ping"}"#)),
            (),
        ))
    });
    let stream = connected.chain(heartbeat);
    Sse::new(stream).keep_alive(KeepAlive::default())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/events", get(events))
}
