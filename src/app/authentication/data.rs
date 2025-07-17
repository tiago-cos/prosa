use crate::app::authentication::models::{AuthError, RefreshToken};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

pub async fn add_refresh_token(
    pool: &SqlitePool,
    user_id: &str,
    refresh_token_hash: &str,
    expiration: DateTime<Utc>,
) -> () {
    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (user_id, refresh_token_hash, expiration)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(user_id)
    .bind(refresh_token_hash)
    .bind(expiration)
    .execute(pool)
    .await
    .expect("Failed to add refresh token");
}

pub async fn get_refresh_token_by_hash(pool: &SqlitePool, refresh_token_hash: &str) -> Option<RefreshToken> {
    let token: Option<RefreshToken> = sqlx::query_as(
        r#"
        SELECT 
            user_id,
            refresh_token_hash,
            expiration
        FROM refresh_tokens
        WHERE refresh_token_hash = $1
        "#,
    )
    .bind(refresh_token_hash)
    .fetch_optional(pool)
    .await
    .expect("Failed to get refresh token by hash");

    token
}

pub async fn delete_refresh_token(pool: &SqlitePool, token_hash: &str) -> Result<(), AuthError> {
    let result = sqlx::query(
        r#"
        DELETE FROM refresh_tokens
        WHERE refresh_token_hash = $1
        "#,
    )
    .bind(token_hash)
    .execute(pool)
    .await
    .expect("Failed to delete refresh token");

    if result.rows_affected() == 0 {
        return Err(AuthError::MissingToken);
    }

    Ok(())
}
