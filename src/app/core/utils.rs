use axum::{Json, response::IntoResponse};
use serde::Serialize;

use crate::{CONFIG, app::users::models::PROVIDERS};

#[derive(Serialize)]
pub struct HealthResponse {
    status: &'static str,
    software: &'static str,
    version: &'static str,
}

pub async fn health_check() -> impl IntoResponse {
    let body = HealthResponse {
        status: "ok",
        software: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    };

    Json(body)
}

#[derive(Serialize)]
pub struct ProviderInfo {
    pub provider_id: &'static str,
    pub requires_api_key: bool,
}

#[derive(Serialize)]
pub struct PublicConfiguration {
    pub allow_user_registration: bool,
    pub metadata_providers: Vec<ProviderInfo>,
}

pub async fn get_public_config() -> impl IntoResponse {
    let pub_config = PublicConfiguration {
        allow_user_registration: CONFIG.auth.allow_user_registration,
        metadata_providers: PROVIDERS
            .iter()
            .map(|(provider_id, requires_api_key)| ProviderInfo {
                provider_id,
                requires_api_key: *requires_api_key,
            })
            .collect(),
    };

    Json(pub_config)
}
//TODO add new health check function to docs

//TODO I'm sure I changed some other thing as well, verify docs

//TODO I added the public key response endpoint

//TODO document the config endpoint

//TODO document the change in the create book endpoint where you can optionally provide a UUID

//TODO change kobont and dockerfile healthcheck to reflect new endpoint

//TODO change controller and repository to "handlers" and "data"

//TODO add invalid book id and book id conflict errors in upload book to docs
