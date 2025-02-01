use crate::app::AppState;
use axum::extract::FromRef;
use config::{Config, ConfigError, File};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct Server {
    pub host: String,
    pub port: u16,
}

#[derive(Deserialize)]
pub struct Auth {
    pub secret_key: String,
    pub admin_key: String,
    pub token_duration: u64,
}

#[derive(Deserialize)]
pub struct Configuration {
    pub server: Server,
    pub auth: Auth,
    pub book_storage: BookStorage,
    pub database: Database,
}

#[derive(Deserialize)]
pub struct BookStorage {
    pub epub_path: String,
    pub cover_path: String,
}

#[derive(Deserialize)]
pub struct Database {
    pub file_path: String,
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
