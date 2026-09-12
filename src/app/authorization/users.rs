use crate::app::{
    authentication::models::{AuthError, AuthToken, AuthType, CREATE, DELETE, READ, UPDATE},
    error::ProsaError,
};
use axum::{
    Extension,
    extract::{Path, Request},
    middleware::Next,
    response::IntoResponse,
};

pub async fn can_create_api_key(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(CREATE) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_read_api_key(
    Extension(token): Extension<AuthToken>,
    Path((user_id, _)): Path<(String, String)>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_read_api_keys(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_delete_api_key(
    Extension(token): Extension<AuthToken>,
    Path((user_id, _)): Path<(String, String)>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(DELETE) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_preferences(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_read_preferences(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_read_profile(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_profile(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::Jwt {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    if !token.can_act_for(&user_id) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}
