use crate::app::{
    authentication::models::{AuthError, AuthToken, READ},
    error::ProsaError,
};
use axum::{
    Extension,
    extract::{Query, Request},
    middleware::Next,
    response::IntoResponse,
};
use std::collections::HashMap;

pub async fn can_sync(
    Extension(token): Extension<AuthToken>,
    Query(params): Query<HashMap<String, String>>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    match params.get("user_id") {
        Some(id) if !token.can_act_for(id) => Err(AuthError::Forbidden.into()),
        _ => Ok(next.run(request).await),
    }
}
