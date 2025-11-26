use crate::app::{
    AppState,
    authentication::{middleware::extract_token_middleware, models::AuthToken},
    authorization::shelves::{
        can_add_book_to_shelf, can_create_shelf, can_delete_book_from_shelf, can_delete_shelf,
        can_read_shelf, can_search_shelves, can_update_shelf,
    },
    error::ProsaError,
    shelves::models::{
        AddBookToShelfRequest, CreateShelfRequest, PaginatedShelves, ShelfMetadata, UpdateShelfRequest,
    },
};
use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};
use std::collections::HashMap;

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/shelves", post(add_shelf_handler)
            .route_layer(from_fn_with_state(state.clone(), can_create_shelf))
        )
        .route("/shelves/{shelf_id}", get(get_shelf_metadata_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_shelf))
        )
        .route("/shelves/{shelf_id}", put(update_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_shelf))
        )
        .route("/shelves/{shelf_id}", delete(delete_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_shelf))
        )
        .route("/shelves", get(search_shelves_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_search_shelves))
        )
        .route("/shelves/{shelf_id}/books", post(add_book_to_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_add_book_to_shelf))
        )
        .route("/shelves/{shelf_id}/books", get(list_books_in_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_shelf))
        )
        .route("/shelves/{shelf_id}/books/{book_id}", delete(remove_book_from_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book_from_shelf))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .layer(DefaultBodyLimit::max(31457280))
        .with_state(state)
}

async fn add_shelf_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Json(request): Json<CreateShelfRequest>,
) -> Result<String, ProsaError> {
    state.controllers.shelf.add_shelf(token, request).await
}

async fn get_shelf_metadata_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
) -> Result<Json<ShelfMetadata>, ProsaError> {
    state.controllers.shelf.get_shelf_metadata(&shelf_id).await
}

async fn update_shelf_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
    Json(request): Json<UpdateShelfRequest>,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .shelf
        .update_shelf(token, &shelf_id, request)
        .await
}

async fn delete_shelf_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.shelf.delete_shelf(token, &shelf_id).await
}

async fn search_shelves_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<PaginatedShelves>, ProsaError> {
    state.controllers.shelf.search_shelves(params).await
}

async fn add_book_to_shelf_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
    Json(request): Json<AddBookToShelfRequest>,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .shelf
        .add_book_to_shelf(token, &shelf_id, request)
        .await
}

async fn list_books_in_shelf_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
) -> Result<Json<Vec<String>>, ProsaError> {
    state.controllers.shelf.list_books_in_shelf(&shelf_id).await
}

async fn remove_book_from_shelf_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path((shelf_id, book_id)): Path<(String, String)>,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .shelf
        .remove_book_from_shelf(token, &shelf_id, &book_id)
        .await
}
