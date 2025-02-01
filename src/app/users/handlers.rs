use std::{ops::Deref, str::FromStr};

use super::{
    models::{
        ApiKeyError, CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse, LoginUserRequest,
        RegisterUserRequest, UserError,
    },
    service,
};
use crate::app::{
    authentication::{self, models::CAPABILITIES},
    error::ProsaError,
    AppState, Pool,
};
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use regex::Regex;

pub async fn register_user_handler(
    State(state): State<AppState>,
    body: Json<RegisterUserRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let filter = Regex::new(r"^[\w.!@-]*$").unwrap();
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
    body: Json<LoginUserRequest>,
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
    body: Json<CreateApiKeyRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    if body
        .capabilities
        .iter()
        .any(|e| !CAPABILITIES.contains(&e.deref()))
    {
        return Err(ApiKeyError::InvalidCapabilities.into());
    }

    let expiration = body
        .expires_at
        .as_deref()
        .map(|date| DateTime::<Utc>::from_str(date).map_err(|_| ApiKeyError::InvalidTimestamp))
        .transpose()?;

    expiration.filter(|date| date >= &Utc::now()).ok_or(ApiKeyError::InvalidTimestamp)?;

    let (key_id, key) = service::create_api_key(
        &pool,
        &username,
        &body.name,
        expiration,
        body.capabilities.clone(),
    )
    .await?;

    let response = CreateApiKeyResponse::new(key_id, key);
    Ok(Json(response))
}

pub async fn get_api_key_handler(
    State(pool): State<Pool>,
    Path((username, key_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let key = service::get_api_key(&pool, &key_id).await?;

    if key.user_id != username {
        return Err(ApiKeyError::KeyNotFound.into());
    }

    let key = GetApiKeyResponse::new(
        key.name,
        key.capabilities,
        key.expiration.map(|date| date.to_rfc2822()),
    );

    Ok(Json(key))
}
