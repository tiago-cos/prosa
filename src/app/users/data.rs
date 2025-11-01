use crate::app::users::models::UserProfile;

use super::models::{ApiKey, ApiKeyError, Preferences, PreferencesError, User, UserError};
use sqlx::{QueryBuilder, SqlitePool};

pub async fn add_user(
    pool: &SqlitePool,
    username: &str,
    user_id: &str,
    password_hash: &str,
    is_admin: bool,
) -> Result<(), UserError> {
    sqlx::query(
        r"
        INSERT INTO users (user_id, username, password_hash, is_admin, automatic_metadata)
        VALUES ($1, $2, $3, $4, $5)
        ",
    )
    .bind(user_id)
    .bind(username)
    .bind(password_hash)
    .bind(is_admin)
    .bind(true)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_user(pool: &SqlitePool, user_id: &str) -> Result<User, UserError> {
    let user = sqlx::query_as(
        r"
        SELECT user_id, username, password_hash, is_admin
        FROM users
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn update_user_profile(
    pool: &SqlitePool,
    user_id: &str,
    profile: UserProfile,
) -> Result<(), UserError> {
    let result = sqlx::query(
        r"
        UPDATE users
        SET username = $1
        WHERE user_id = $2
        ",
    )
    .bind(profile.username)
    .bind(user_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(UserError::UserNotFound);
    }

    Ok(())
}

pub async fn get_user_by_username(pool: &SqlitePool, username: &str) -> Result<User, UserError> {
    let user = sqlx::query_as(
        r"
        SELECT user_id, username, password_hash, is_admin
        FROM users
        WHERE username = $1
        ",
    )
    .bind(username)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn get_api_key_information(
    pool: &SqlitePool,
    user_id: &str,
    key_id: &str,
) -> Result<ApiKey, ApiKeyError> {
    let mut key: ApiKey = sqlx::query_as(
        r"
        SELECT 
            key_id,
            user_id,
            name,
            expiration
        FROM api_keys
        WHERE key_id = $1 AND user_id = $2
        ",
    )
    .bind(key_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let capabilities: Vec<String> = sqlx::query_scalar(
        r"
        SELECT capability
        FROM key_capabilities
        WHERE key_id = $1
        ",
    )
    .bind(key_id)
    .fetch_all(pool)
    .await?;

    key.capabilities = capabilities;

    Ok(key)
}

pub async fn list_api_keys(pool: &SqlitePool, user_id: &str) -> Result<Vec<String>, ApiKeyError> {
    let keys: Vec<String> = sqlx::query_scalar(
        r"
        SELECT key_id
        FROM api_keys
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(keys)
}

pub async fn add_providers(pool: &SqlitePool, user_id: &str, providers: Vec<String>) -> () {
    let mut index = 1;
    let mut query = QueryBuilder::new("INSERT INTO providers (provider_type, priority, user_id)");

    query.push_values(providers, |mut b, provider| {
        b.push_bind(provider).push_bind(index).push_bind(user_id);
        index += 1;
    });
    query
        .build()
        .execute(pool)
        .await
        .expect("Failed to add initial providers");
}

pub async fn get_preferences(pool: &SqlitePool, user_id: &str) -> Result<Preferences, PreferencesError> {
    let providers: Vec<String> = sqlx::query_scalar(
        r"
        SELECT provider_type
        FROM providers
        WHERE user_id = $1
        ORDER BY priority
        ",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let automatic_metadata: bool = sqlx::query_scalar(
        r"
        SELECT automatic_metadata
        FROM users
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(Preferences {
        metadata_providers: Some(providers),
        automatic_metadata: Some(automatic_metadata),
    })
}

pub async fn update_preferences(
    pool: &SqlitePool,
    user_id: &str,
    preferences: Preferences,
) -> Result<(), PreferencesError> {
    let automatic_metadata = preferences
        .automatic_metadata
        .expect("Metadata preference should be present");
    let providers = preferences
        .metadata_providers
        .expect("Providers should be present");

    let mut tx = pool.begin().await?;

    sqlx::query(
        r"
        UPDATE users
        SET automatic_metadata = $1
        WHERE user_id = $2
        ",
    )
    .bind(automatic_metadata)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        DELETE
        FROM providers
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    if providers.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    let mut index = 1;
    let mut query = QueryBuilder::new("INSERT INTO providers (provider_type, priority, user_id)");

    query.push_values(providers, |mut b, provider| {
        b.push_bind(provider).push_bind(index).push_bind(user_id);
        index += 1;
    });
    query.build().execute(&mut *tx).await?;

    tx.commit().await?;

    Ok(())
}
