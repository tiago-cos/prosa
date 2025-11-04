use crate::app::{
    AppState,
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_read_book, can_update_book},
    error::ProsaError,
    state::models,
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{get, patch, put},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/state", get(get_state_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/state", put(update_state_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/state", patch(patch_state_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}

async fn get_state_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<Json<models::State>, ProsaError> {
    state.controllers.state.get_state(book_id).await
}

async fn patch_state_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(book_state): Json<models::State>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.state.patch_state(book_id, book_state).await
}

async fn update_state_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(book_state): Json<models::State>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.state.update_state(book_id, book_state).await
}
