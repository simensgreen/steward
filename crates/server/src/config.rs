//! Runtime configuration from environment.

use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub bind: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("STEWARD_DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:data/steward.db?mode=rwc".to_string()),
            bind: env::var("STEWARD_BIND").unwrap_or_else(|_| "127.0.0.1:8080".to_string()),
        }
    }
}
