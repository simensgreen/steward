//! In-process event bus for SSE live sync (ADR-0028).

use serde::Serialize;
use serde_json::json;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<String>,
}

#[derive(Clone, Serialize)]
pub struct DomainEvent {
    pub kind: String,
    pub resource: String,
    pub id: String,
}

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(256);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.sender.subscribe()
    }

    pub fn publish(&self, kind: &str, resource: &str, id: &str) {
        let payload = json!({
            "kind": kind,
            "resource": resource,
            "id": id,
        })
        .to_string();
        let _ = self.sender.send(payload);
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
