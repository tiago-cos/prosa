use crate::app::{
    AppState,
    authentication::{middleware::extract_token_middleware, models::AuthToken},
    authorization::sync::can_sync,
    error::ProsaError,
    sync::models::UnsyncedResponse,
};
use axum::{
    Extension, Json, Router,
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
};
use std::collections::HashMap;

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/sync", get(get_unsynced_handler)
            .route_layer(from_fn_with_state(state.clone(), can_sync))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}

async fn get_unsynced_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
    Extension(token): Extension<AuthToken>,
) -> Result<Json<UnsyncedResponse>, ProsaError> {
    state.controllers.sync.get_unsynced(params, token).await
}
