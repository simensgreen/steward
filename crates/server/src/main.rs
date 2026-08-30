//! Process entrypoint for steward-server.

use steward_server::config::Config;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Config::from_env();
    if let Err(error) = steward_server::run(config).await {
        tracing::error!("Server failed: {error}");
        std::process::exit(1);
    }
}
