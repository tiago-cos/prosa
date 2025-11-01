use crate::app::{
    authentication::models::{ApiKeyError, AuthTokenError, RefreshToken},
    users::models::ApiKey,
};
use chrono::{DateTime, Utc};
use sqlx::{QueryBuilder, SqlitePool};

pub async fn add_refresh_token(
    pool: &SqlitePool,
    user_id: &str,
    refresh_token_hash: &str,
    expiration: DateTime<Utc>,
) -> () {
    sqlx::query(
        r"
        INSERT INTO refresh_tokens (user_id, refresh_token_hash, expiration)
        VALUES ($1, $2, $3)
        ",
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
        r"
        SELECT 
            user_id,
            refresh_token_hash,
            expiration
        FROM refresh_tokens
        WHERE refresh_token_hash = $1
        ",
    )
    .bind(refresh_token_hash)
    .fetch_optional(pool)
    .await
    .expect("Failed to get refresh token by hash");

    token
}

pub async fn delete_refresh_token(pool: &SqlitePool, token_hash: &str) -> Result<(), AuthTokenError> {
    let result = sqlx::query(
        r"
        DELETE FROM refresh_tokens
        WHERE refresh_token_hash = $1
        ",
    )
    .bind(token_hash)
    .execute(pool)
    .await
    .expect("Failed to delete refresh token");

    if result.rows_affected() == 0 {
        return Err(AuthTokenError::MissingToken);
    }

    Ok(())
}

pub async fn add_api_key(
    pool: &SqlitePool,
    key_id: &str,
    user_id: &str,
    key_hash: &str,
    name: &str,
    expiration: Option<DateTime<Utc>>,
    capabilities: Vec<String>,
) -> Result<(), ApiKeyError> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r"
        INSERT INTO api_keys (key_id, user_id, key_hash, name, expiration)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ",
    )
    .bind(key_id)
    .bind(user_id)
    .bind(key_hash)
    .bind(name)
    .bind(expiration)
    .execute(&mut *tx)
    .await?;

    let mut query = QueryBuilder::new("INSERT INTO key_capabilities (key_id, capability)");

    query.push_values(capabilities, |mut b, capability| {
        b.push_bind(key_id).push_bind(capability);
    });
    query.build().execute(&mut *tx).await?;

    tx.commit().await?;

    Ok(())
}

pub async fn get_api_key_by_hash(pool: &SqlitePool, key_hash: &str) -> Option<ApiKey> {
    let mut key: ApiKey = sqlx::query_as(
        r"
        SELECT 
            key_id,
            user_id,
            name,
            expiration
        FROM api_keys
        WHERE key_hash = ?1
        ",
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await
    .expect("Failed to get api key by hash")?;

    let capabilities: Vec<String> = sqlx::query_scalar(
        r"
        SELECT capability
        FROM key_capabilities
        WHERE key_id = $1
        ",
    )
    .bind(&key.key_id)
    .fetch_all(pool)
    .await
    .expect("Failed to get api key capabilities");

    key.capabilities = capabilities;

    Some(key)
}

pub async fn delete_api_key(pool: &SqlitePool, user_id: &str, key_id: &str) -> Result<(), ApiKeyError> {
    let result = sqlx::query(
        r"
        DELETE
        FROM api_keys
        WHERE key_id = $1 AND user_id = $2
        ",
    )
    .bind(key_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiKeyError::KeyNotFound);
    }

    Ok(())
}
