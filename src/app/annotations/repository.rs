use super::models::{Annotation, AnnotationError, NewAnnotationRequest};
use crate::DB_POOL;

pub async fn add_annotation(
    annotation_id: &str,
    book_id: &str,
    annotation: &NewAnnotationRequest,
) -> Result<(), AnnotationError> {
    sqlx::query(
        r"
        INSERT INTO annotations (annotation_id, book_id, source, start_tag, end_tag, start_char, end_char, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ",
    )
    .bind(annotation_id)
    .bind(book_id)
    .bind(&annotation.source)
    .bind(&annotation.start_tag)
    .bind(&annotation.end_tag)
    .bind(annotation.start_char)
    .bind(annotation.end_char)
    .bind(&annotation.note)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    Ok(())
}

pub async fn get_annotation(annotation_id: &str) -> Result<Annotation, AnnotationError> {
    let annotation = sqlx::query_as::<_, Annotation>(
        r"
        SELECT annotation_id, source, start_tag, end_tag, start_char, end_char, note
        FROM annotations
        WHERE annotation_id = $1
        ",
    )
    .bind(annotation_id)
    .fetch_one(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    Ok(annotation)
}

pub async fn get_annotations(book_id: &str) -> Vec<String> {
    sqlx::query_scalar(
        r"
        SELECT annotation_id
        FROM annotations
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_all(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to retrieve book annotations")
}

pub async fn delete_annotation(annotation_id: &str) -> Result<(), AnnotationError> {
    let result = sqlx::query(
        r"
        DELETE FROM annotations
        WHERE annotation_id = $1
        ",
    )
    .bind(annotation_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to delete annotation");

    if result.rows_affected() == 0 {
        return Err(AnnotationError::AnnotationNotFound);
    }

    Ok(())
}

pub async fn patch_annotation(annotation_id: &str, note: Option<String>) -> Result<(), AnnotationError> {
    let result = sqlx::query(
        r"
        UPDATE annotations
        SET note = $1
        WHERE annotation_id = $2
        ",
    )
    .bind(note)
    .bind(annotation_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to patch annotation");

    if result.rows_affected() == 0 {
        return Err(AnnotationError::AnnotationNotFound);
    }

    Ok(())
}
