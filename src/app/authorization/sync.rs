use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, READ},
    error::ProsaError,
};
use axum::{
    extract::{Path, Request},
    middleware::Next,
    response::IntoResponse,
    Extension,
};

async fn username_matches(username: &str, token: AuthToken) -> bool {
    let user_id = match token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    username == user_id
}

pub async fn can_sync(
    Extension(token): Extension<AuthToken>,
    Path(user_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if !username_matches(&user_id, token).await {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}
