use super::models::EpubError;
use sqlx::SqliteExecutor;

pub async fn add_epub<'e>(db: impl SqliteExecutor<'e>, epub_id: &str, hash: &str) {
    sqlx::query(
        r"
        INSERT INTO epubs (epub_id, hash)
        VALUES ($1, $2)
        ",
    )
    .bind(epub_id)
    .bind(hash)
    .execute(db)
    .await
    .expect("Failed to add epub");
}

pub async fn delete_epub<'e>(db: impl SqliteExecutor<'e>, epub_id: &str) -> Result<(), EpubError> {
    let result = sqlx::query(
        r"
        DELETE FROM epubs
        WHERE epub_id = $1
        ",
    )
    .bind(epub_id)
    .execute(db)
    .await
    .expect("Failed to delete epub");

    if result.rows_affected() == 0 {
        return Err(EpubError::EpubNotFound);
    }

    Ok(())
}

pub async fn get_epub_by_hash<'e>(db: impl SqliteExecutor<'e>, hash: &str) -> Option<String> {
    sqlx::query_scalar(
        r"
        SELECT epub_id
        FROM epubs
        WHERE hash = $1
        ",
    )
    .bind(hash)
    .fetch_optional(db)
    .await
    .expect("Failed to get epub by hash")
}
