use crate::app::{
    authentication::{
        models::{AuthRole, AuthToken, AuthType, IdentityResponse},
        service,
    },
    error::ProsaError,
    users,
};
use axum::{Extension, Json};
use jsonwebtoken::jwk::JwkSet;

pub async fn fetch_jwks_handler() -> Result<Json<JwkSet>, ProsaError> {
    let jwks = service::generate_jwks();
    Ok(Json(jwks))
}

pub async fn fetch_identity_handler(
    Extension(token): Extension<AuthToken>,
) -> Result<Json<IdentityResponse>, ProsaError> {
    let key_id = match token.auth_type {
        AuthType::ApiKey => Some(token.session_id),
        AuthType::Jwt => None,
    };

    let user = users::service::get_user(token.role.get_user()).await?;

    Ok(Json(IdentityResponse {
        auth_type: token.auth_type,
        user_id: user.user_id,
        username: user.username,
        is_admin: matches!(token.role, AuthRole::Admin(_)),
        capabilities: token.capabilities,
        key_id,
    }))
}
