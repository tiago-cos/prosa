use axum::{Json, response::IntoResponse};
use serde::Serialize;

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

//TODO add new health check function to docs

//TODO I'm sure I changed some other thing as well, verify docs

//TODO I added the public key response endpoint

//TODO document the config endpoint

//TODO document the change in the create book endpoint where you can optionally provide a UUID

//TODO change kobont and dockerfile healthcheck to reflect new endpoint
