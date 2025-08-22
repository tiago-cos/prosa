use crate::app::AppState;
use axum::extract::FromRef;
use config::{Config, ConfigError, File};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize, Clone)]
pub struct Configuration {
    pub server: Server,
    pub auth: Auth,
    pub book_storage: BookStorage,
    pub metadata_cooldown: MetadataCooldown,
    pub database: Database,
    pub kepubify: Kepubify,
}

#[derive(Deserialize, Clone)]
pub struct Server {
    pub host: String,
    pub port: u16,
}

#[derive(Deserialize, Clone)]
pub struct Auth {
    pub secret_key: String,
    pub admin_key: String,
    pub jwt_token_duration: u64,
    pub refresh_token_duration: u64,
}

#[derive(Deserialize, Clone)]
pub struct BookStorage {
    pub epub_path: String,
    pub cover_path: String,
}

#[derive(Deserialize, Clone)]
pub struct Kepubify {
    pub path: String,
}

#[derive(Deserialize, Clone)]
pub struct Database {
    pub file_path: String,
}

#[derive(Deserialize, Clone)]
pub struct MetadataCooldown {
    pub goodreads: u64,
    pub epub_extractor: u64,
}

impl Configuration {
    pub fn new() -> Result<Self, ConfigError> {
        let default_config_path = std::env::var("PROSA_DEFAULT_CONFIGURATION")
            .unwrap_or_else(|_| "src/config/default.toml".to_string());

        let local_config_path = std::env::var("PROSA_LOCAL_CONFIGURATION")
            .unwrap_or_else(|_| "src/config/local.toml".to_string());

        let conf = Config::builder()
            .add_source(File::with_name(&default_config_path))
            .add_source(File::with_name(&local_config_path).required(false))
            .add_source(config::Environment::with_prefix("PROSA").separator("__"))
            .build()?;

        conf.try_deserialize()
    }
}

impl FromRef<AppState> for Arc<Configuration> {
    fn from_ref(state: &AppState) -> Arc<Configuration> {
        Arc::clone(&state.config)
    }
}
