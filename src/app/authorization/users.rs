use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, AuthType, CREATE, DELETE, READ, UPDATE},
    error::ProsaError,
};
use axum::{
    extract::{Path, Request},
    middleware::Next,
    response::IntoResponse,
    Extension,
};

async fn user_id_matches(user_id: &str, token: AuthToken) -> bool {
    let token_user_id = match token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    user_id == token_user_id
}

pub async fn can_create_api_key(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&CREATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&DELETE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
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
    if token.auth_type != AuthType::JWT {
        return Err(AuthError::Forbidden.into());
    }

    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !user_id_matches(&user_id, token).await {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}
