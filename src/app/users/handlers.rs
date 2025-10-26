use super::{
    models::{
        CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse, LoginUserRequest, Preferences,
        RegisterUserRequest, UserError,
    },
    service,
};
use crate::app::{
    AppState,
    authentication::{self, models::AuthError},
    error::ProsaError,
    users::models::{AuthenticationResponse, RefreshTokenRequest, UserProfile},
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use sqlx::SqlitePool;

pub async fn register_user_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RegisterUserRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let registration_allowed = state.config.auth.allow_user_registration;
    match (registration_allowed, body.admin, headers.get("admin-key")) {
        (false, _, None) => return Err(UserError::RegistrationDisabled.into()),
        (_, _, Some(key)) if key == &state.config.auth.admin_key => (),
        (_, false, None) => (),
        _ => return Err(UserError::InvalidCredentials.into()),
    }

    let user_id = service::register_user(&state.pool, &body.username, &body.password, body.admin).await?;

    let jwt_token = authentication::service::generate_jwt(
        &state.config.auth.jwt_key_path,
        &user_id,
        body.admin,
        state.config.auth.jwt_token_duration,
    )
    .await;

    let refresh_token = authentication::service::generate_refresh_token(
        &state.pool,
        &user_id,
        state.config.auth.refresh_token_duration,
    )
    .await;

    Ok(Json(AuthenticationResponse {
        jwt_token,
        refresh_token,
        user_id,
    }))
}

pub async fn login_user_handler(
    State(state): State<AppState>,
    Json(body): Json<LoginUserRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let user = service::login_user(&state.pool, &body.username, &body.password).await?;

    let jwt_token = authentication::service::generate_jwt(
        &state.config.auth.jwt_key_path,
        &user.user_id,
        user.is_admin,
        state.config.auth.jwt_token_duration,
    )
    .await;

    let refresh_token = authentication::service::generate_refresh_token(
        &state.pool,
        &user.user_id,
        state.config.auth.refresh_token_duration,
    )
    .await;

    Ok(Json(AuthenticationResponse {
        jwt_token,
        refresh_token,
        user_id: user.user_id,
    }))
}

pub async fn logout_user_handler(
    State(state): State<AppState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    authentication::service::invalidate_refresh_token(&state.pool, &body.refresh_token).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn refresh_token_handler(
    State(state): State<AppState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let (refresh_token, encoded_refresh_token) = authentication::service::renew_refresh_token(
        &state.pool,
        &body.refresh_token,
        state.config.auth.refresh_token_duration,
    )
    .await?;

    let Ok(user) = service::get_user(&state.pool, &refresh_token.user_id).await else {
        return Err(AuthError::InvalidToken.into());
    };

    let jwt_token = authentication::service::generate_jwt(
        &state.config.auth.jwt_key_path,
        &user.user_id,
        user.is_admin,
        state.config.auth.jwt_token_duration,
    )
    .await;

    Ok(Json(AuthenticationResponse {
        jwt_token,
        refresh_token: encoded_refresh_token,
        user_id: user.user_id,
    }))
}

pub async fn create_api_key_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let (key_id, key) =
        service::create_api_key(&pool, &user_id, &body.name, body.expires_at, body.capabilities).await?;

    let response = CreateApiKeyResponse { id: key_id, key };
    Ok(Json(response))
}

pub async fn get_api_key_handler(
    State(pool): State<SqlitePool>,
    Path((user_id, key_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let key = service::get_api_key(&pool, &user_id, &key_id).await?;

    let key = GetApiKeyResponse {
        name: key.name,
        capabilities: key.capabilities,
        expires_at: key.expiration.map(|date| date.timestamp_millis()),
    };

    Ok(Json(key))
}

pub async fn get_api_keys_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let keys = service::get_api_keys(&pool, &user_id).await?;

    Ok(Json(keys))
}

pub async fn revoke_api_key_handler(
    State(pool): State<SqlitePool>,
    Path((user_id, key_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    service::revoke_api_key(&pool, &user_id, &key_id).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn get_preferences_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let preferences = service::get_preferences(&pool, &user_id).await?;

    Ok(Json(preferences))
}

pub async fn update_preferences_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<impl IntoResponse, ProsaError> {
    service::update_preferences(&pool, &user_id, body).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn patch_preferences_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<impl IntoResponse, ProsaError> {
    service::patch_preferences(&pool, &user_id, body).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn get_user_profile_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let profile = service::get_user_profile(&pool, &user_id).await?;

    Ok(Json(profile))
}

pub async fn update_user_profile_handler(
    State(pool): State<SqlitePool>,
    Path(user_id): Path<String>,
    Json(body): Json<UserProfile>,
) -> Result<impl IntoResponse, ProsaError> {
    service::update_user_profile(&pool, &user_id, body).await?;

    Ok((StatusCode::NO_CONTENT, ()))
}
