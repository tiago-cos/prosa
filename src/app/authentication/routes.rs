use crate::app::authentication::controller::fetch_jwks_handler;
use axum::{Router, routing::get};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/.well-known/jwks.json", get(fetch_jwks_handler))
}
