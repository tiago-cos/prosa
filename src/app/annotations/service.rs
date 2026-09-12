use super::models::{Annotation, AnnotationError, NewAnnotationRequest};
use crate::app::core::ids;
use crate::app::epubs;
use crate::app::{annotations::repository, books, error::ProsaError};
use crate::database::pool;
use kepub_rs::validate_epub_location;
use std::fs::File;

pub async fn add_annotation(
    book_id: &str,
    mut annotation: NewAnnotationRequest,
) -> Result<String, ProsaError> {
    let epub_id = books::repository::get_book(pool(), book_id).await?.epub_id;

    let annotation_id =
        ids::resolve(annotation.annotation_id.take()).map_err(|_| AnnotationError::InvalidAnnotationId)?;

    if repository::annotation_exists(pool(), &annotation_id).await {
        return Err(AnnotationError::AnnotationIdConflict.into());
    }

    if !validate_annotation(&annotation, &epub_id).await {
        return Err(AnnotationError::InvalidAnnotation.into());
    }

    repository::add_annotation(pool(), &annotation_id, book_id, &annotation).await?;

    Ok(annotation_id)
}

pub async fn get_annotation(annotation_id: &str) -> Result<Annotation, ProsaError> {
    let annotation = repository::get_annotation(pool(), annotation_id).await?;
    Ok(annotation)
}

pub async fn get_annotations(book_id: &str) -> Vec<String> {
    repository::get_annotations(pool(), book_id).await
}

pub async fn delete_annotation(annotation_id: &str) -> Result<(), ProsaError> {
    repository::delete_annotation(pool(), annotation_id).await?;
    Ok(())
}

pub async fn patch_annotation(annotation_id: &str, note: Option<String>) -> Result<(), ProsaError> {
    let note = note.filter(|n| !n.is_empty());
    repository::patch_annotation(pool(), annotation_id, note).await?;
    Ok(())
}

async fn validate_annotation(annotation: &NewAnnotationRequest, epub_id: &str) -> bool {
    let epub_file = epubs::service::epub_path(epub_id);
    let start = annotation.start_location.clone();
    let end = annotation.end_location.clone();

    //TODO add annotation relative order verification in kepub-rs crate.
    tokio::task::spawn_blocking(move || {
        [start, end].iter().all(|location| {
            File::open(&epub_file).is_ok_and(|file| validate_epub_location(file, location).is_ok())
        })
    })
    .await
    .expect("Annotation validation task failed")
}
