use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, READ},
    error::ProsaError,
};
use axum::{
    Extension,
    extract::{Query, Request},
    middleware::Next,
    response::IntoResponse,
};
use std::collections::HashMap;

async fn user_id_matches(user_id: &str, token: &AuthToken) -> bool {
    let token_user_id = match &token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    user_id == token_user_id
}

pub async fn can_sync(
    Extension(token): Extension<AuthToken>,
    Query(params): Query<HashMap<String, String>>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    match params.get("user_id") {
        Some(id) if !user_id_matches(&id, &token).await => return Err(AuthError::Forbidden.into()),
        _ => return Ok(next.run(request).await),
    };
}
