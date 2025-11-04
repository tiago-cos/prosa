use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::users::{
        can_create_api_key, can_delete_api_key, can_read_api_key, can_read_api_keys, can_read_preferences,
        can_read_profile, can_update_preferences, can_update_profile,
    },
    error::ProsaError,
    server::AppState,
    users::models::{
        AuthenticationResponse, CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse,
        LoginUserRequest, Preferences, RefreshTokenRequest, RegisterUserRequest, UserProfile,
    },
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    middleware::{from_fn, from_fn_with_state},
    routing::{delete, get, patch, post, put},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/users/{user_id}/keys", post(create_api_key_handler)
            .route_layer(from_fn(can_create_api_key))
        )
        .route("/users/{user_id}/keys/{key_id}", get(get_api_information_key_handler) 
            .route_layer(from_fn(can_read_api_key))
        )
        .route("/users/{user_id}/keys", get(list_api_keys_handler) 
            .route_layer(from_fn(can_read_api_keys))
        )
        .route("/users/{user_id}/keys/{key_id}", delete(revoke_api_key_handler) 
            .route_layer(from_fn(can_delete_api_key))
        )
        .route("/users/{user_id}/preferences", put(update_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{user_id}/preferences", patch(patch_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{user_id}/preferences", get(get_preferences_handler) 
            .route_layer(from_fn(can_read_preferences))
        )
        .route("/users/{user_id}", get(get_user_profile_handler) 
            .route_layer(from_fn(can_read_profile))
        )
        .route("/users/{user_id}", put(update_user_profile_handler) 
            .route_layer(from_fn(can_update_profile))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .route("/auth/register", post(register_user_handler))
        .route("/auth/login", post(login_user_handler))
        .route("/auth/logout", post(logout_user_handler))
        .route("/auth/refresh", post(refresh_token_handler))
        .with_state(state)
}

async fn register_user_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<RegisterUserRequest>,
) -> Result<Json<AuthenticationResponse>, ProsaError> {
    state.controllers.user.register_user(headers, body).await
}

async fn login_user_handler(
    State(state): State<AppState>,
    Json(body): Json<LoginUserRequest>,
) -> Result<Json<AuthenticationResponse>, ProsaError> {
    state.controllers.user.login_user(body).await
}

async fn logout_user_handler(
    State(state): State<AppState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.user.logout_user(body).await
}

async fn refresh_token_handler(
    State(state): State<AppState>,
    Json(body): Json<RefreshTokenRequest>,
) -> Result<Json<AuthenticationResponse>, ProsaError> {
    state.controllers.user.refresh_token(body).await
}

async fn create_api_key_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ProsaError> {
    state.controllers.user.create_api_key(user_id, body).await
}

async fn get_api_information_key_handler(
    State(state): State<AppState>,
    Path((user_id, key_id)): Path<(String, String)>,
) -> Result<Json<GetApiKeyResponse>, ProsaError> {
    state
        .controllers
        .user
        .get_api_information_key(user_id, key_id)
        .await
}

async fn list_api_keys_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> Result<Json<Vec<String>>, ProsaError> {
    state.controllers.user.list_api_keys(user_id).await
}

async fn revoke_api_key_handler(
    State(state): State<AppState>,
    Path((user_id, key_id)): Path<(String, String)>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.user.revoke_api_key(user_id, key_id).await
}

async fn get_preferences_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> Result<Json<Preferences>, ProsaError> {
    state.controllers.user.get_preferences(user_id).await
}

async fn update_preferences_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.user.update_preferences(user_id, body).await
}

async fn patch_preferences_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(body): Json<Preferences>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.user.patch_preferences(user_id, body).await
}

async fn get_user_profile_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> Result<Json<UserProfile>, ProsaError> {
    state.controllers.user.get_user_profile(user_id).await
}

async fn update_user_profile_handler(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
    Json(body): Json<UserProfile>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.user.update_user_profile(user_id, body).await
}
