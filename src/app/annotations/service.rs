use super::models::{Annotation, AnnotationError, NewAnnotationRequest};
use crate::app::core::ids;
use crate::app::server::LOCKS;
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::{annotations::repository, books, error::ProsaError};
use crate::app::{epubs, sync};
use crate::database::pool;
use kepub_rs::{compare_locations, location_is_text};
use std::cmp::Ordering;
use std::fs::File;

pub async fn add_annotation(
    book_id: &str,
    mut annotation: NewAnnotationRequest,
    session_id: &str,
) -> Result<String, ProsaError> {
    let book = books::service::get_book(book_id).await?;
    let epub_id = book.epub_id;

    let annotation_id =
        ids::resolve(annotation.annotation_id.take()).map_err(|_| AnnotationError::InvalidAnnotationId)?;

    let lock = LOCKS.get_annotation_lock(&annotation_id).await;
    let _guard = lock.write().await;

    if repository::annotation_exists(pool(), &annotation_id).await {
        return Err(AnnotationError::AnnotationIdConflict.into());
    }

    if !validate_annotation(&annotation, &epub_id).await {
        return Err(AnnotationError::InvalidAnnotation.into());
    }

    repository::add_annotation(pool(), &annotation_id, book_id, &annotation).await?;

    log_change(book_id, ChangeLogAction::Create, &book.owner_id, session_id).await;

    Ok(annotation_id)
}

pub async fn get_annotation(annotation_id: &str) -> Result<Annotation, ProsaError> {
    let annotation = repository::get_annotation(pool(), annotation_id).await?;
    Ok(annotation)
}

pub async fn get_annotations(book_id: &str) -> Vec<String> {
    repository::get_annotations(pool(), book_id).await
}

pub async fn delete_annotation(
    book_id: &str,
    annotation_id: &str,
    session_id: &str,
) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;
    repository::delete_annotation(pool(), annotation_id).await?;
    log_change(book_id, ChangeLogAction::Delete, &book.owner_id, session_id).await;
    Ok(())
}

pub async fn patch_annotation(
    book_id: &str,
    annotation_id: &str,
    note: Option<String>,
    session_id: &str,
) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;
    let note = note.filter(|n| !n.is_empty());
    repository::patch_annotation(pool(), annotation_id, note).await?;
    log_change(book_id, ChangeLogAction::Update, &book.owner_id, session_id).await;
    Ok(())
}

async fn validate_annotation(annotation: &NewAnnotationRequest, epub_id: &str) -> bool {
    let start = annotation.start_location.clone();
    let end = annotation.end_location.clone();

    let both_text = [&start, &end]
        .into_iter()
        .all(|location| location_is_text(location).unwrap_or(false));

    if !both_text {
        return false;
    }

    let epub_file = epubs::service::epub_path(epub_id);

    tokio::task::spawn_blocking(move || {
        File::open(&epub_file)
            .is_ok_and(|file| compare_locations(file, &start, &end).is_ok_and(Ordering::is_lt))
    })
    .await
    .expect("Annotation validation task failed")
}

async fn log_change(book_id: &str, action: ChangeLogAction, owner_id: &str, session_id: &str) {
    sync::service::log_change(
        book_id,
        ChangeLogEntityType::BookAnnotations,
        action,
        owner_id,
        session_id,
    )
    .await;
}
