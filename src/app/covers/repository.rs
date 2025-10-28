use super::models::CoverError;
use sqlx::SqlitePool;

pub struct CoverRepository {
    pool: SqlitePool,
}

impl CoverRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn add_cover(&self, cover_id: &str, hash: &str) {
        sqlx::query(
            r"
            INSERT INTO covers (cover_id, hash)
            VALUES ($1, $2)
            ",
        )
        .bind(cover_id)
        .bind(hash)
        .execute(&self.pool)
        .await
        .expect("Failed to add cover");
    }

    pub async fn delete_cover(&self, cover_id: &str) -> Result<(), CoverError> {
        let result = sqlx::query(
            r"
            DELETE FROM covers
            WHERE cover_id = $1
            ",
        )
        .bind(cover_id)
        .execute(&self.pool)
        .await
        .expect("Failed to delete cover");

        if result.rows_affected() == 0 {
            return Err(CoverError::CoverNotFound);
        }

        Ok(())
    }

    pub async fn get_cover_by_hash(&self, hash: &str) -> Option<String> {
        sqlx::query_scalar(
            r"
            SELECT cover_id
            FROM covers
            WHERE hash = $1
            ",
        )
        .bind(hash)
        .fetch_optional(&self.pool)
        .await
        .expect("Failed to get cover by hash")
    }
}
