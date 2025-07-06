use super::{
    data,
    models::{ApiKey, Preferences, User, UserError},
};
use crate::app::{
    authentication::{self, service::hash_secret},
    error::ProsaError,
    users::models::{ApiKeyError, PreferencesError, VALID_PROVIDERS},
};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use chrono::{DateTime, Utc};
use merge::Merge;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn register_user(
    pool: &SqlitePool,
    username: &str,
    password: &str,
    is_admin: bool,
) -> Result<(), ProsaError> {
    let password_hash = hash_secret(password).await;
    data::add_user(pool, username, &password_hash, is_admin).await?;
    data::add_providers(pool, username, vec![VALID_PROVIDERS[0].to_string()]).await;

    Ok(())
}

pub async fn login_user(pool: &SqlitePool, username: &str, password: &str) -> Result<User, UserError> {
    let user = data::get_user(pool, username).await?;
    let password_hash = PasswordHash::new(&user.password_hash).expect("Failed to parse password hash");

    Argon2::default()
        .verify_password(password.as_bytes(), &password_hash)
        .map_err(|_| UserError::InvalidCredentials)?;

    Ok(user)
}

pub async fn create_api_key(
    pool: &SqlitePool,
    username: &str,
    key_name: &str,
    expiration: Option<DateTime<Utc>>,
    capabilities: Vec<String>,
) -> Result<(String, String), ProsaError> {
    if capabilities.is_empty() {
        return Err(ApiKeyError::InvalidCapabilities.into());
    }

    let key_id = Uuid::new_v4().to_string();
    let (key, hash) = authentication::service::generate_api_key().await;

    data::add_api_key(pool, &key_id, username, &hash, key_name, expiration, capabilities).await?;
    Ok((key_id, key))
}

pub async fn get_api_key(pool: &SqlitePool, username: &str, key_id: &str) -> Result<ApiKey, ProsaError> {
    // To verify if user exists
    data::get_user(pool, username).await?;
    let key = data::get_api_key(pool, username, key_id).await?;
    Ok(key)
}

pub async fn get_api_keys(pool: &SqlitePool, username: &str) -> Result<Vec<String>, ProsaError> {
    data::get_user(pool, username).await?;
    let keys = data::get_api_keys(pool, username).await?;
    Ok(keys)
}

pub async fn revoke_api_key(pool: &SqlitePool, username: &str, key_id: &str) -> Result<(), ProsaError> {
    data::get_user(pool, username).await?;
    data::delete_api_key(pool, username, key_id).await?;
    Ok(())
}

pub async fn get_preferences(pool: &SqlitePool, username: &str) -> Result<Preferences, ProsaError> {
    data::get_user(pool, username).await?;
    let preferences = data::get_preferences(pool, username).await?;
    Ok(preferences)
}

pub async fn update_preferences(
    pool: &SqlitePool,
    username: &str,
    preferences: Preferences,
) -> Result<(), ProsaError> {
    data::get_user(pool, username).await?;

    if preferences.automatic_metadata.is_none() {
        return Err(PreferencesError::MissingAutomaticMetadata.into());
    }

    if preferences.metadata_providers.is_none() {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    data::update_preferences(pool, username, preferences).await?;
    Ok(())
}

pub async fn patch_preferences(
    pool: &SqlitePool,
    username: &str,
    mut preferences: Preferences,
) -> Result<(), ProsaError> {
    data::get_user(pool, username).await?;

    if preferences.automatic_metadata.is_none() && preferences.metadata_providers.is_none() {
        return Err(PreferencesError::InvalidPreferences.into());
    }

    let original = data::get_preferences(pool, username).await?;
    preferences.merge(original);

    if preferences.automatic_metadata.is_none() {
        return Err(PreferencesError::MissingAutomaticMetadata.into());
    }

    data::update_preferences(pool, username, preferences).await?;
    Ok(())
}

pub async fn user_exists(pool: &SqlitePool, username: &str) -> Result<(), ProsaError> {
    data::get_user(pool, username).await?;
    Ok(())
}
