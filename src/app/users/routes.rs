use super::handlers;
use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::users::{
        can_create_api_key, can_delete_api_key, can_read_api_key, can_read_api_keys, can_read_preferences,
        can_update_preferences,
    },
    server::AppState,
};
use axum::{
    middleware::{from_fn, from_fn_with_state},
    routing::{delete, get, patch, post, put},
    Router,
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/users/{user_id}/keys", post(handlers::create_api_key_handler)
            .route_layer(from_fn(can_create_api_key))
        )
        .route("/users/{user_id}/keys/{key_id}", get(handlers::get_api_key_handler) 
            .route_layer(from_fn(can_read_api_key))
        )
        .route("/users/{user_id}/keys", get(handlers::get_api_keys_handler) 
            .route_layer(from_fn(can_read_api_keys))
        )
        .route("/users/{user_id}/keys/{key_id}", delete(handlers::revoke_api_key_handler) 
            .route_layer(from_fn(can_delete_api_key))
        )
        .route("/users/{user_id}/preferences", put(handlers::update_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{user_id}/preferences", patch(handlers::patch_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{user_id}/preferences", get(handlers::get_preferences_handler) 
            .route_layer(from_fn(can_read_preferences))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .route("/auth/register", post(handlers::register_user_handler))
        .route("/auth/login", post(handlers::login_user_handler))
        .route("/auth/logout", post(handlers::logout_user_handler))
        .route("/auth/refresh", post(handlers::refresh_token_handler))
        .with_state(state)
}
