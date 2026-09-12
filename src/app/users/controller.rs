use super::models::{
    CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse, LoginUserRequest, Preferences,
    RegisterUserRequest,
};
use crate::app::{
    authentication::{self, models::AuthenticationResponse},
    error::ProsaError,
    users::{
        models::{RefreshTokenRequest, UserProfile},
        service,
    },
};
use axum::{
    Json,
    extract::Path,
    http::{HeaderMap, StatusCode},
};

pub async fn register_user_handler(
    headers: HeaderMap,
    Json(body): Json<RegisterUserRequest>,
) -> Result<Json<AuthenticationResponse>, ProsaError> {
    let admin_key = headers.get("admin-key").and_then(|h| h.to_str().ok());
    authentication::service::can_register(body.admin, admin_key)?;

    let user_id = service::register_user(&body.username, &body.password, body.admin, body.user_id).await?;
    let session = authentication::service::establish_session(&user_id, body.admin).await;

    Ok(Json(session))
}

pub async fn login_user_handler(
    Json(body): Json<LoginUserRequest>,
) -> Result<Json<AuthenticationResponse>, ProsaError> {
    let user = service::login_user(&body.username, &body.password).await?;
    let session = authentication::service::establish_session(&user.user_id, user.is_admin).await;

    Ok(Json(session))
}

pub async fn logout_user_handler(Json(body): Json<RefreshTokenRequest>) -> Result<StatusCode, ProsaError> {
    authentication::service::invalidate_refresh_token(&body.refresh_token).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn refresh_token_handler(
    Json(body): Json<RefreshTokenRequest>,
) -> Result<Json<AuthenticationResponse>, ProsaError> {
    let session = authentication::service::resume_session(&body.refresh_token).await?;
    Ok(Json(session))
}

pub async fn create_api_key_handler(
    Path(user_id): Path<String>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ProsaError> {
    let (key_id, key) = authentication::service::generate_api_key(
        &user_id,
        &body.name,
        body.expires_at,
        body.capabilities,
        body.key_id,
    )
    .await?;

    Ok(Json(CreateApiKeyResponse { id: key_id, key }))
}

pub async fn get_api_information_key_handler(
    Path((user_id, key_id)): Path<(String, String)>,
) -> Result<Json<GetApiKeyResponse>, ProsaError> {
    let key = service::get_api_key_information(&user_id, &key_id).await?;
    let response = GetApiKeyResponse {
        name: key.name,
        capabilities: key.capabilities,
        expires_at: key.expiration.map(|date| date.timestamp_millis()),
    };

    Ok(Json(response))
}

pub async fn list_api_keys_handler(Path(user_id): Path<String>) -> Result<Json<Vec<String>>, ProsaError> {
    let keys = service::list_api_keys(&user_id).await?;
    Ok(Json(keys))
}

pub async fn revoke_api_key_handler(
    Path((user_id, key_id)): Path<(String, String)>,
) -> Result<StatusCode, ProsaError> {
    authentication::service::revoke_api_key(&user_id, &key_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_preferences_handler(Path(user_id): Path<String>) -> Result<Json<Preferences>, ProsaError> {
    let preferences = service::get_preferences(&user_id).await?;
    Ok(Json(preferences))
}

pub async fn update_preferences_handler(
    Path(user_id): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<StatusCode, ProsaError> {
    service::update_preferences(&user_id, body).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn patch_preferences_handler(
    Path(user_id): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<StatusCode, ProsaError> {
    service::patch_preferences(&user_id, body).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_user_profile_handler(Path(user_id): Path<String>) -> Result<Json<UserProfile>, ProsaError> {
    let profile = service::get_user_profile(&user_id).await?;
    Ok(Json(profile))
}

pub async fn update_user_profile_handler(
    Path(user_id): Path<String>,
    Json(body): Json<UserProfile>,
) -> Result<StatusCode, ProsaError> {
    service::update_user_profile(&user_id, body).await?;
    Ok(StatusCode::NO_CONTENT)
}
