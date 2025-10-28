use std::sync::Arc;

use super::models::{AuthError, AuthToken};
use crate::app::{AppState, authentication::service::AuthenticationService, error::ProsaError};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, HeaderValue},
    middleware::Next,
    response::IntoResponse,
};

pub async fn extract_token_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    let jwt_header = headers.get("Authorization");
    let api_key_header = headers.get("api-key");

    let token = match (jwt_header, api_key_header) {
        (Some(header), _) => handle_jwt(header, &state.services.authentication)?,
        (_, Some(header)) => handle_api_key(header, state.services.authentication).await?,
        _ => Err(AuthError::MissingAuth)?,
    };

    request.extensions_mut().insert(token);
    Ok(next.run(request).await)
}

fn handle_jwt(
    header: &HeaderValue,
    authentication_service: &Arc<AuthenticationService>,
) -> Result<AuthToken, AuthError> {
    let header = header.to_str().expect("Failed to convert jwt header to string");

    let (_, token) = header
        .split_whitespace()
        .collect::<Vec<_>>()
        .get(0..2)
        .map(|parts| (parts[0], parts[1]))
        .ok_or(AuthError::InvalidAuthHeader)?;

    let token = authentication_service.verify_jwt(token)?;

    Ok(token)
}

async fn handle_api_key(
    header: &HeaderValue,
    authentication_service: Arc<AuthenticationService>,
) -> Result<AuthToken, AuthError> {
    let api_key = header.to_str().expect("Failed to convert key header to string");
    let token = authentication_service.verify_api_key(api_key).await?;

    Ok(token)
}
