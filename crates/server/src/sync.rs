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
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let connected =
        stream::once(async { Ok(Event::default().event("connected").data(r#"{"ok":true}"#)) });
    let receiver = state.events.subscribe();
    let domain = stream::unfold(receiver, |mut receiver| async move {
        match receiver.recv().await {
            Ok(payload) => Some((Ok(Event::default().event("change").data(payload)), receiver)),
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => Some((
                Ok(Event::default()
                    .event("lagged")
                    .data(r#"{"ok":false,"reason":"lagged"}"#)),
                receiver,
            )),
            Err(tokio::sync::broadcast::error::RecvError::Closed) => None,
        }
    });
    let heartbeat = stream::unfold((), |()| async {
        tokio::time::sleep(Duration::from_secs(15)).await;
        Some((
            Ok(Event::default().event("heartbeat").data(r#"{"ts":"ping"}"#)),
            (),
        ))
    });
    let stream = connected.chain(domain).merge(heartbeat);
    Sse::new(stream).keep_alive(KeepAlive::default())
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/events", get(events))
}
