use super::{
    models::{AuthError, AuthToken},
    service,
};
use crate::app::{AppState, error::ProsaError};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, HeaderValue},
    middleware::Next,
    response::IntoResponse,
};
use sqlx::SqlitePool;

pub async fn extract_token_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    let jwt_header = headers.get("Authorization");
    let api_key_header = headers.get("api-key");

    let token = match (jwt_header, api_key_header) {
        (Some(header), _) => handle_jwt(&state.config.auth.secret_key, header)?,
        (_, Some(header)) => handle_api_key(&state.pool, header).await?,
        _ => Err(AuthError::MissingAuth)?,
    };

    request.extensions_mut().insert(token);
    Ok(next.run(request).await)
}

fn handle_jwt(secret: &str, header: &HeaderValue) -> Result<AuthToken, AuthError> {
    let header = header.to_str().expect("Failed to convert jwt header to string");

    let (_, token) = header
        .split_whitespace()
        .collect::<Vec<_>>()
        .get(0..2)
        .map(|parts| (parts[0], parts[1]))
        .ok_or(AuthError::InvalidAuthHeader)?;

    let token = service::verify_jwt(token, secret)?;

    Ok(token)
}

async fn handle_api_key(pool: &SqlitePool, header: &HeaderValue) -> Result<AuthToken, AuthError> {
    let key = header.to_str().expect("Failed to convert key header to string");
    let token = service::verify_api_key(pool, key).await?;

    Ok(token)
}
