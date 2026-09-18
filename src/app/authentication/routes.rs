use crate::app::{
    authentication::{
        controller::{fetch_identity_handler, fetch_jwks_handler},
        middleware::extract_token_middleware,
    },
    authorization::authentication::can_read_identity,
};
use axum::{Router, middleware::from_fn, routing::get};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/auth/me", get(fetch_identity_handler)
            .route_layer(from_fn(can_read_identity))
        )
        .layer(from_fn(extract_token_middleware))
        .route("/.well-known/jwks.json", get(fetch_jwks_handler))
}
