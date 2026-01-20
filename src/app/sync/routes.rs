use crate::app::{
    authentication::middleware::extract_token_middleware, authorization::sync::can_sync,
    sync::controller::get_unsynced_handler,
};
use axum::{Router, middleware::from_fn, routing::get};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/sync", get(get_unsynced_handler)
            .route_layer(from_fn(can_sync))
        )
        .layer(from_fn(extract_token_middleware))
}
