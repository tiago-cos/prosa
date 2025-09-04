use crate::app::AppState;
use axum::extract::FromRef;
use config::{Config, ConfigError, File};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Default, Deserialize, Clone)]
#[serde(default)]
pub struct Configuration {
    pub server: Server,
    pub auth: Auth,
    pub book_storage: BookStorage,
    pub metadata_cooldown: MetadataCooldown,
    pub database: Database,
    pub kepubify: Kepubify,
}

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct Server {
    pub host: String,
    pub port: u16,
}

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct Auth {
    pub admin_key: String,
    pub jwt_token_duration: u64,
    pub refresh_token_duration: u64,
    pub allow_user_registration: bool,
    pub jwt_key_path: String,
}

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct BookStorage {
    pub epub_path: String,
    pub cover_path: String,
}

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct Kepubify {
    pub path: String,
}

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct Database {
    pub file_path: String,
}

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct MetadataCooldown {
    pub goodreads: u64,
    pub epub_extractor: u64,
}

impl Default for Server {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 5000,
        }
    }
}

impl Default for Auth {
    fn default() -> Self {
        Self {
            admin_key: String::default(),
            jwt_token_duration: 900,
            refresh_token_duration: 604800,
            allow_user_registration: true,
            jwt_key_path: "library/jwt_secret_key.bin".to_string(),
        }
    }
}

impl Default for BookStorage {
    fn default() -> Self {
        Self {
            epub_path: "library/epubs".to_string(),
            cover_path: "library/covers".to_string(),
        }
    }
}

impl Default for MetadataCooldown {
    fn default() -> Self {
        Self {
            goodreads: 1000,
            epub_extractor: 0,
        }
    }
}

impl Default for Database {
    fn default() -> Self {
        Self {
            file_path: "library/database.db".to_string(),
        }
    }
}

impl Default for Kepubify {
    fn default() -> Self {
        Self {
            path: "kepubify/kepubify".to_string(),
        }
    }
}

impl Configuration {
    pub fn new() -> Result<Self, ConfigError> {
        let config_path = std::env::var("CONFIGURATION").unwrap_or_else(|_| "configuration.toml".to_string());

        let conf = Config::builder()
            .add_source(File::with_name(&config_path).required(false))
            .add_source(config::Environment::default().separator("__"))
            .build()?;

        conf.try_deserialize()
    }
}

impl FromRef<AppState> for Arc<Configuration> {
    fn from_ref(state: &AppState) -> Arc<Configuration> {
        Arc::clone(&state.config)
    }
}
