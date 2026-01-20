use super::models::EpubError;
use crate::DB_POOL;

pub async fn add_epub(epub_id: &str, hash: &str) {
    sqlx::query(
        r"
        INSERT INTO epubs (epub_id, hash)
        VALUES ($1, $2)
        ",
    )
    .bind(epub_id)
    .bind(hash)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to add epub");
}

pub async fn delete_epub(epub_id: &str) -> Result<(), EpubError> {
    let result = sqlx::query(
        r"
        DELETE FROM epubs
        WHERE epub_id = $1
        ",
    )
    .bind(epub_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to delete epub");

    if result.rows_affected() == 0 {
        return Err(EpubError::EpubNotFound);
    }

    Ok(())
}

pub async fn get_epub_by_hash(hash: &str) -> Option<String> {
    sqlx::query_scalar(
        r"
        SELECT epub_id
        FROM epubs
        WHERE hash = $1
        ",
    )
    .bind(hash)
    .fetch_optional(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to get epub by hash")
}
