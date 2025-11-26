use crate::app::{
    AppState,
    authentication::{middleware::extract_token_middleware, models::AuthToken},
    authorization::books::{can_delete_book, can_read_book, can_update_book},
    error::ProsaError,
};
use axum::{
    Extension, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/cover", get(get_cover_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/cover", post(add_cover_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/cover", delete(delete_cover_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book))
        )
        .route("/books/{book_id}/cover", put(update_cover_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .layer(DefaultBodyLimit::max(15728640))
        .with_state(state)
}

async fn get_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<Vec<u8>, ProsaError> {
    state.controllers.cover.get_cover(&book_id).await
}

async fn add_cover_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .cover
        .add_cover(token, &book_id, cover_data)
        .await
}

async fn delete_cover_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.cover.delete_cover(token, &book_id).await
}

async fn update_cover_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .cover
        .update_cover(token, &book_id, cover_data)
        .await
}
