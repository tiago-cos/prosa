use super::handlers;
use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::middleware::{can_create_api_key, can_read_api_key},
    server::AppState,
};
use axum::{
    middleware::{from_fn, from_fn_with_state},
    routing::{get, post},
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
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .route("/users", post(handlers::register_user_handler))
        .route("/users/{username}", post(handlers::login_user_handler))
        .with_state(state)
}
