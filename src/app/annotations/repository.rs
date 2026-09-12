use super::models::{Annotation, AnnotationError, NewAnnotationRequest};
use sqlx::SqliteExecutor;

pub async fn add_annotation<'e>(
    db: impl SqliteExecutor<'e>,
    annotation_id: &str,
    book_id: &str,
    annotation: &NewAnnotationRequest,
) -> Result<(), AnnotationError> {
    sqlx::query(
        r"
        INSERT INTO annotations (annotation_id, book_id, start_location, end_location, note)
        VALUES ($1, $2, $3, $4, $5)
        ",
    )
    .bind(annotation_id)
    .bind(book_id)
    .bind(&annotation.start_location)
    .bind(&annotation.end_location)
    .bind(&annotation.note)
    .execute(db)
    .await?;

    Ok(())
}

pub async fn get_annotation<'e>(
    db: impl SqliteExecutor<'e>,
    annotation_id: &str,
) -> Result<Annotation, AnnotationError> {
    let annotation = sqlx::query_as::<_, Annotation>(
        r"
        SELECT annotation_id, start_location, end_location, note
        FROM annotations
        WHERE annotation_id = $1
        ",
    )
    .bind(annotation_id)
    .fetch_one(db)
    .await?;

    Ok(annotation)
}

pub async fn get_annotations<'e>(db: impl SqliteExecutor<'e>, book_id: &str) -> Vec<String> {
    sqlx::query_scalar(
        r"
        SELECT annotation_id
        FROM annotations
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_all(db)
    .await
    .expect("Failed to retrieve book annotations")
}

pub async fn delete_annotation<'e>(
    db: impl SqliteExecutor<'e>,
    annotation_id: &str,
) -> Result<(), AnnotationError> {
    let result = sqlx::query(
        r"
        DELETE FROM annotations
        WHERE annotation_id = $1
        ",
    )
    .bind(annotation_id)
    .execute(db)
    .await
    .expect("Failed to delete annotation");

    if result.rows_affected() == 0 {
        return Err(AnnotationError::AnnotationNotFound);
    }

    Ok(())
}

pub async fn patch_annotation<'e>(
    db: impl SqliteExecutor<'e>,
    annotation_id: &str,
    note: Option<String>,
) -> Result<(), AnnotationError> {
    let result = sqlx::query(
        r"
        UPDATE annotations
        SET note = $1
        WHERE annotation_id = $2
        ",
    )
    .bind(note)
    .bind(annotation_id)
    .execute(db)
    .await
    .expect("Failed to patch annotation");

    if result.rows_affected() == 0 {
        return Err(AnnotationError::AnnotationNotFound);
    }

    Ok(())
}

pub async fn annotation_exists<'e>(db: impl SqliteExecutor<'e>, annotation_id: &str) -> bool {
    sqlx::query_scalar(
        r"
        SELECT EXISTS(SELECT 1 FROM annotations WHERE annotation_id = ?)
        ",
    )
    .bind(annotation_id)
    .fetch_one(db)
    .await
    .unwrap_or(false)
}
