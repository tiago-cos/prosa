use crate::app::AppState;
use axum::extract::FromRef;
use config::{Config, ConfigError, File};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize, Clone)]
pub struct Server {
    pub host: String,
    pub port: u16,
}

#[derive(Deserialize, Clone)]
pub struct Auth {
    pub secret_key: String,
    pub admin_key: String,
    pub token_duration: u64,
}

#[derive(Deserialize, Clone)]
pub struct Configuration {
    pub server: Server,
    pub auth: Auth,
    pub book_storage: BookStorage,
    pub metadata_cooldown: MetadataCooldown,
    pub database: Database,
}

#[derive(Deserialize, Clone)]
pub struct BookStorage {
    pub epub_path: String,
    pub cover_path: String,
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
        let conf = Config::builder()
            .add_source(File::with_name("src/config/default.toml"))
            .add_source(File::with_name("src/config/local.toml").required(false))
            .build()?;
        conf.try_deserialize()
    }
}

impl FromRef<AppState> for Arc<Configuration> {
    fn from_ref(state: &AppState) -> Arc<Configuration> {
        Arc::clone(&state.config)
    }
}
