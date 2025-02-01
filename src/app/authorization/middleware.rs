use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, AuthType},
    error::ProsaError,
};
use axum::{
    extract::{Path, Request},
    middleware::Next,
    response::IntoResponse,
    Extension,
};

pub async fn can_create_api_key(
    Extension(token): Extension<AuthToken>,
    Path(username): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    let user_id = match token.role {
        AuthRole::Admin(_) => return Ok(next.run(request).await),
        AuthRole::User(id) => id,
    };

    if username != user_id {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_read_api_key(
    Extension(token): Extension<AuthToken>,
    Path((username, _)): Path<(String, String)>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    let user_id = match token.role {
        AuthRole::Admin(_) => return Ok(next.run(request).await),
        AuthRole::User(id) => id,
    };

    if username != user_id {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}
