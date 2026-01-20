use super::models::CoverError;
use crate::DB_POOL;

pub async fn add_cover(cover_id: &str, hash: &str) {
    sqlx::query(
        r"
        INSERT INTO covers (cover_id, hash)
        VALUES ($1, $2)
        ",
    )
    .bind(cover_id)
    .bind(hash)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to add cover");
}

pub async fn delete_cover(cover_id: &str) -> Result<(), CoverError> {
    let result = sqlx::query(
        r"
        DELETE FROM covers
        WHERE cover_id = $1
        ",
    )
    .bind(cover_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to delete cover");

    if result.rows_affected() == 0 {
        return Err(CoverError::CoverNotFound);
    }

    Ok(())
}

pub async fn get_cover_by_hash(hash: &str) -> Option<String> {
    sqlx::query_scalar(
        r"
        SELECT cover_id
        FROM covers
        WHERE hash = $1
        ",
    )
    .bind(hash)
    .fetch_optional(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to get cover by hash")
}
