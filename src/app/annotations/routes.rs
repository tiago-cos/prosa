use crate::app::{
    AppState,
    annotations::models::{NewAnnotationRequest, PatchAnnotationRequest},
    authentication::middleware::extract_token_middleware,
    authorization::{
        annotations::{can_read_annotation, can_update_annotation},
        books::{can_read_book, can_update_book},
    },
    error::ProsaError,
};
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    response::IntoResponse,
    routing::{delete, get, patch, post},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/annotations", post(add_annotation_handler)
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", get(get_annotation_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_annotation))
        )
        .route("/books/{book_id}/annotations", get(list_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", delete(delete_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_annotation))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", patch(patch_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_annotation))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}

pub async fn add_annotation_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(annotation): Json<NewAnnotationRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let annotation_id = state
        .controllers
        .annotation
        .add_annotation(&book_id, annotation)
        .await?;
    Ok(annotation_id)
}

pub async fn get_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let annotation = state
        .controllers
        .annotation
        .get_annotation(&book_id, &annotation_id)
        .await?;
    Ok(Json(annotation))
}

pub async fn list_annotation_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let annotations = state.controllers.annotation.list_annotations(&book_id).await?;
    Ok(Json(annotations))
}

pub async fn delete_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    state
        .controllers
        .annotation
        .delete_annotation(&book_id, &annotation_id)
        .await?;
    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn patch_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
    Json(request): Json<PatchAnnotationRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    state
        .controllers
        .annotation
        .patch_annotation(&book_id, &annotation_id, request)
        .await?;
    Ok((StatusCode::NO_CONTENT, ()))
}
