//! Shared helpers for IDs, time, and money parsing.

use chrono::{DateTime, Utc};
use uuid::Uuid;

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

pub fn parse_rfc3339(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

/// Convert a major-unit decimal amount (e.g. 12.34) to minor units.
pub fn to_minor(amount: f64) -> i64 {
    (amount * 100.0).round() as i64
}

pub fn from_minor(amount_minor: i64) -> f64 {
    amount_minor as f64 / 100.0
}
