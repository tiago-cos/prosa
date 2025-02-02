use super::models::{ApiKey, ApiKeyError, Preferences, PreferencesError, User, UserError};
use chrono::{DateTime, Utc};
use sqlx::{QueryBuilder, SqlitePool};

pub async fn add_user(
    pool: &SqlitePool,
    user_id: &str,
    password_hash: &str,
    is_admin: bool,
) -> Result<(), UserError> {
    sqlx::query(
        r#"
        INSERT INTO users (user_id, password_hash, is_admin)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(user_id)
    .bind(password_hash)
    .bind(is_admin)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_user(pool: &SqlitePool, user_id: &str) -> Result<User, UserError> {
    let user = sqlx::query_as(
        r#"
        SELECT user_id, password_hash, is_admin
        FROM users
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
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
        r#"
        INSERT INTO api_keys (key_id, user_id, key_hash, name, expiration)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
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

pub async fn get_api_key(pool: &SqlitePool, username: &str, key_id: &str) -> Result<ApiKey, ApiKeyError> {
    let mut key: ApiKey = sqlx::query_as(
        r#"
        SELECT 
            key_id,
            user_id,
            key_hash,
            name,
            expiration
        FROM api_keys
        WHERE key_id = $1 AND user_id = $2
        "#,
    )
    .bind(key_id)
    .bind(username)
    .fetch_one(pool)
    .await?;

    let capabilities: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT capability
        FROM key_capabilities
        WHERE key_id = $1
        "#,
    )
    .bind(key_id)
    .fetch_all(pool)
    .await?;

    key.capabilities = capabilities;

    Ok(key)
}

pub async fn get_api_key_by_hash(pool: &SqlitePool, key_hash: &str) -> Option<ApiKey> {
    let mut key: ApiKey = sqlx::query_as(
        r#"
        SELECT 
            key_id,
            user_id,
            key_hash,
            name,
            expiration
        FROM api_keys
        WHERE key_hash = ?1
        "#,
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await
    .expect("Failed to get api key by hash")?;

    let capabilities: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT capability
        FROM key_capabilities
        WHERE key_id = $1
        "#,
    )
    .bind(&key.key_id)
    .fetch_all(pool)
    .await
    .expect("Failed to get api key capabilities");

    key.capabilities = capabilities;

    Some(key)
}

pub async fn get_api_keys(pool: &SqlitePool, username: &str) -> Result<Vec<String>, ApiKeyError> {
    let keys: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT key_id
        FROM api_keys
        WHERE user_id = $1
        "#,
    )
    .bind(username)
    .fetch_all(pool)
    .await?;

    Ok(keys)
}

pub async fn delete_api_key(pool: &SqlitePool, username: &str, key_id: &str) -> Result<(), ApiKeyError> {
    let result = sqlx::query(
        r#"
        DELETE
        FROM api_keys
        WHERE key_id = $1 AND user_id = $2
        "#,
    )
    .bind(key_id)
    .bind(username)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiKeyError::KeyNotFound);
    }

    Ok(())
}

pub async fn add_preferences(
    pool: &SqlitePool,
    username: &str,
    providers: Vec<String>,
) -> Result<(), PreferencesError> {
    if providers.is_empty() {
        return Err(PreferencesError::InvalidMetadataProvider);
    }

    let mut tx = pool.begin().await?;

    let mut index = 1;
    let mut query = QueryBuilder::new("INSERT INTO providers (provider_type, priority, user_id)");

    query.push_values(providers, |mut b, provider| {
        b.push_bind(provider).push_bind(index).push_bind(username);
        index = index + 1;
    });
    query.build().execute(&mut *tx).await?;

    tx.commit().await?;

    Ok(())
}

pub async fn get_preferences(
    pool: &SqlitePool,
    username: &str,
) -> Result<Preferences, PreferencesError> {
    let providers: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT provider_type
        FROM providers
        WHERE user_id = $1
        ORDER BY priority
        "#,
    )
    .bind(username)
    .fetch_all(pool)
    .await?;

    Ok(Preferences::new(providers))
}

pub async fn delete_preferences(
    pool: &SqlitePool,
    username: &str,
) -> Result<(), PreferencesError> {
    sqlx::query(
        r#"
        DELETE
        FROM providers
        WHERE user_id = $1
        "#,
    )
    .bind(username)
    .execute(pool)
    .await?;

    Ok(())
}