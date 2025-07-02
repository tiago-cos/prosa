use super::{
    models::{
        ApiKeyError, CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse, LoginUserRequest,
        Preferences, RegisterUserRequest, UserError,
    },
    service,
};
use crate::app::{authentication, error::ProsaError, AppState, Pool};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use regex::Regex;

pub async fn register_user_handler(
    State(state): State<AppState>,
    Json(body): Json<RegisterUserRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let filter = Regex::new(r"^[\w.!@-]+$").unwrap();
    if !filter.is_match(&body.username) || !filter.is_match(&body.password) {
        return Err(UserError::InvalidInput.into());
    }

    let is_admin = match &body.admin_key {
        Some(key) if key == &state.config.auth.admin_key => true,
        Some(_) => return Err(UserError::InvalidCredentials.into()),
        None => false,
    };

    service::register_user(&state.pool, &body.username, &body.password, is_admin).await?;

    let token = authentication::service::generate_jwt(
        &state.config.auth.secret_key,
        body.username.clone(),
        is_admin,
        &state.config.auth.token_duration,
    )
    .await;

    Ok(token)
}

pub async fn login_user_handler(
    State(state): State<AppState>,
    Path(username): Path<String>,
    Json(body): Json<LoginUserRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let user = service::login_user(&state.pool, &username, &body.password).await?;

    let token = authentication::service::generate_jwt(
        &state.config.auth.secret_key,
        username,
        user.is_admin,
        &state.config.auth.token_duration,
    )
    .await;

    Ok(token)
}

pub async fn create_api_key_handler(
    State(pool): State<Pool>,
    Path(username): Path<String>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let expiration = body
        .expires_at
        .map(|date| DateTime::<Utc>::from_timestamp_millis(date))
        .map(|result| result.ok_or(ApiKeyError::InvalidTimestamp))
        .transpose()?;

    if expiration.filter(|date| date >= &Utc::now()) != expiration {
        return Err(ApiKeyError::InvalidTimestamp.into());
    }

    let (key_id, key) = service::create_api_key(
        &pool,
        &username,
        &body.name,
        expiration,
        body.capabilities.clone(),
    )
    .await?;

    let response = CreateApiKeyResponse { id: key_id, key };
    Ok(Json(response))
}

pub async fn get_api_key_handler(
    State(pool): State<Pool>,
    Path((username, key_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let key = service::get_api_key(&pool, &username, &key_id).await?;

    let key = GetApiKeyResponse {
        name: key.name,
        capabilities: key.capabilities,
        expires_at: key.expiration.map(|date| date.timestamp_millis()),
    };

    Ok(Json(key))
}

pub async fn get_api_keys_handler(
    State(pool): State<Pool>,
    Path(username): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let keys = service::get_api_keys(&pool, &username).await?;

    Ok(Json(keys))
}

pub async fn revoke_api_key_handler(
    State(pool): State<Pool>,
    Path((username, key_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    service::revoke_api_key(&pool, &username, &key_id).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn get_preferences_handler(
    State(pool): State<Pool>,
    Path(username): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let preferences = service::get_preferences(&pool, &username).await?;

    Ok(Json(preferences))
}

pub async fn update_preferences_handler(
    State(pool): State<Pool>,
    Path(username): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<impl IntoResponse, ProsaError> {
    service::update_preferences(&pool, &username, body.metadata_providers.clone()).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}
