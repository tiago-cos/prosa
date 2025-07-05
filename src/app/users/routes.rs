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
        .route("/users/{username}/keys", post(handlers::create_api_key_handler)
            .route_layer(from_fn(can_create_api_key))
        )
        .route("/users/{username}/keys/{key_id}", get(handlers::get_api_key_handler) 
            .route_layer(from_fn(can_read_api_key))
        )
        .route("/users/{username}/keys", get(handlers::get_api_keys_handler) 
            .route_layer(from_fn(can_read_api_keys))
        )
        .route("/users/{username}/keys/{key_id}", delete(handlers::revoke_api_key_handler) 
            .route_layer(from_fn(can_delete_api_key))
        )
        .route("/users/{username}/preferences", put(handlers::update_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{username}/preferences", patch(handlers::patch_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{username}/preferences", get(handlers::get_preferences_handler) 
            .route_layer(from_fn(can_read_preferences))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .route("/users", post(handlers::register_user_handler))
        .route("/users/{username}", post(handlers::login_user_handler))
        .with_state(state)
}
