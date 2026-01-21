use crate::app::{authentication::service, error::ProsaError};
use axum::Json;
use jsonwebtoken::jwk::JwkSet;

pub async fn fetch_jwks_handler() -> Result<Json<JwkSet>, ProsaError> {
    let jwks = service::generate_jwks();
    Ok(Json(jwks))
}
