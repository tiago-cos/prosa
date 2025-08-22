use super::handlers;
use crate::app::{
    AppState, authentication::middleware::extract_token_middleware, authorization::sync::can_sync,
};
use axum::{Router, middleware::from_fn_with_state, routing::get};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/sync", get(handlers::get_unsynced_handler)
            .route_layer(from_fn_with_state(state.clone(), can_sync))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}
