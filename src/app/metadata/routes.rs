use crate::{
    app::{
        AppState,
        authentication::middleware::extract_token_middleware,
        authorization::{
            books::{can_delete_book, can_read_book, can_update_book},
            metadata::{can_add_metadata_request, can_list_metadata_requests},
        },
        error::ProsaError,
        metadata::models::{Metadata, MetadataFetchRequest},
    },
    metadata_manager::MetadataRequest,
};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, patch, post, put},
};
use std::collections::HashMap;

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/metadata", get(get_metadata_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/metadata", post(add_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/metadata", delete(delete_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book))
        )
        .route("/books/{book_id}/metadata", put(update_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/metadata", patch(patch_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/metadata-requests", post(add_metadata_request_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_add_metadata_request))
        )
        .route("/metadata-requests", get(list_metadata_requests_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_list_metadata_requests))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}

pub async fn get_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<Json<Metadata>, ProsaError> {
    state.controllers.metadata.get_metadata(book_id).await
}

pub async fn add_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.metadata.add_metadata(book_id, metadata).await
}

pub async fn delete_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.metadata.delete_metadata(book_id).await
}

pub async fn patch_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.metadata.patch_metadata(book_id, metadata).await
}

pub async fn update_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .metadata
        .update_metadata(book_id, metadata)
        .await
}

pub async fn add_metadata_request_handler(
    State(state): State<AppState>,
    Json(request): Json<MetadataFetchRequest>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.metadata.add_metadata_request(request).await
}

pub async fn list_metadata_requests_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<MetadataRequest>>, ProsaError> {
    state.controllers.metadata.list_metadata_requests(params).await
}
