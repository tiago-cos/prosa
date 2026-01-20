use super::models::{NewAnnotationRequest, PatchAnnotationRequest};
use crate::app::annotations::models::Annotation;
use crate::app::annotations::service;
use crate::app::authentication::models::AuthToken;
use crate::app::error::ProsaError;
use crate::app::server::LOCKS;
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::{books, sync};
use axum::extract::Path;
use axum::http::StatusCode;
use axum::{Extension, Json};

pub async fn add_annotation_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(annotation): Json<NewAnnotationRequest>,
) -> Result<String, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;
    let annotation_id = service::add_annotation(&book_id, annotation).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookAnnotations,
        ChangeLogAction::Create,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(annotation_id)
}

pub async fn get_annotation_handler(
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<Json<Annotation>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    books::service::get_book(&book_id).await?;
    let annotation = service::get_annotation(&annotation_id).await?;

    Ok(Json(annotation))
}

pub async fn list_annotations_handler(Path(book_id): Path<String>) -> Result<Json<Vec<String>>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    books::service::get_book(&book_id).await?;
    let annotations = service::get_annotations(&book_id).await;

    Ok(Json(annotations))
}

pub async fn delete_annotation_handler(
    Extension(token): Extension<AuthToken>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;
    service::delete_annotation(&annotation_id).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookAnnotations,
        ChangeLogAction::Delete,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn patch_annotation_handler(
    Extension(token): Extension<AuthToken>,
    Path((book_id, annotation_id)): Path<(String, String)>,
    Json(request): Json<PatchAnnotationRequest>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;

    service::patch_annotation(&annotation_id, request.note).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookAnnotations,
        ChangeLogAction::Update,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}
