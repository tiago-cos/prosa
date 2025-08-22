use super::{
    data,
    models::{ApiKey, Preferences, User, UserError},
};
use crate::app::{
    authentication::{self, service::hash_secret},
    error::ProsaError,
    users::models::{ApiKeyError, PreferencesError, UserProfile, VALID_PROVIDERS},
};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use chrono::{DateTime, Utc};
use merge::Merge;
use regex::Regex;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn register_user(
    pool: &SqlitePool,
    username: &str,
    password: &str,
    is_admin: bool,
) -> Result<String, ProsaError> {
    verify_username(username)?;
    verify_password(password)?;

    let user_id = Uuid::new_v4().to_string();
    let password_hash = hash_secret(password).await;
    data::add_user(pool, username, &user_id, &password_hash, is_admin).await?;
    data::add_providers(pool, &user_id, vec![VALID_PROVIDERS[0].to_string()]).await;

    Ok(user_id)
}

pub async fn login_user(pool: &SqlitePool, username: &str, password: &str) -> Result<User, UserError> {
    let user = data::get_user_by_username(pool, username).await?;
    let password_hash = PasswordHash::new(&user.password_hash).expect("Failed to parse password hash");

    Argon2::default()
        .verify_password(password.as_bytes(), &password_hash)
        .map_err(|_| UserError::InvalidCredentials)?;

    Ok(user)
}

pub async fn get_user(pool: &SqlitePool, user_id: &str) -> Result<User, ProsaError> {
    let user = data::get_user(pool, user_id).await?;
    Ok(user)
}

pub async fn get_user_by_username(pool: &SqlitePool, username: &str) -> Result<User, ProsaError> {
    let user = data::get_user_by_username(pool, username).await?;
    Ok(user)
}

pub async fn get_user_profile(pool: &SqlitePool, user_id: &str) -> Result<UserProfile, ProsaError> {
    let user = data::get_user(pool, user_id).await?;
    let profile = UserProfile {
        username: user.username,
    };
    Ok(profile)
}

pub async fn update_user_profile(
    pool: &SqlitePool,
    user_id: &str,
    profile: UserProfile,
) -> Result<(), ProsaError> {
    verify_username(&profile.username)?;
    data::update_user_profile(pool, user_id, profile).await?;
    Ok(())
}

pub async fn create_api_key(
    pool: &SqlitePool,
    user_id: &str,
    key_name: &str,
    expiration: Option<i64>,
    capabilities: Vec<String>,
) -> Result<(String, String), ProsaError> {
    if capabilities.is_empty() {
        return Err(ApiKeyError::InvalidCapabilities.into());
    }

    let expiration = expiration
        .map(DateTime::<Utc>::from_timestamp_millis)
        .map(|result| result.ok_or(ApiKeyError::InvalidTimestamp))
        .transpose()?;

    if expiration.filter(|date| date >= &Utc::now()) != expiration {
        return Err(ApiKeyError::InvalidTimestamp.into());
    }

    let key_id = Uuid::new_v4().to_string();
    let (key, hash) = authentication::service::generate_api_key();

    data::add_api_key(pool, &key_id, user_id, &hash, key_name, expiration, capabilities).await?;
    Ok((key_id, key))
}

pub async fn get_api_key(pool: &SqlitePool, user_id: &str, key_id: &str) -> Result<ApiKey, ProsaError> {
    // To verify if user exists
    data::get_user(pool, user_id).await?;
    let key = data::get_api_key(pool, user_id, key_id).await?;
    Ok(key)
}

pub async fn get_api_keys(pool: &SqlitePool, user_id: &str) -> Result<Vec<String>, ProsaError> {
    data::get_user(pool, user_id).await?;
    let keys = data::get_api_keys(pool, user_id).await?;
    Ok(keys)
}

pub async fn revoke_api_key(pool: &SqlitePool, user_id: &str, key_id: &str) -> Result<(), ProsaError> {
    data::get_user(pool, user_id).await?;
    data::delete_api_key(pool, user_id, key_id).await?;
    Ok(())
}

pub async fn get_preferences(pool: &SqlitePool, user_id: &str) -> Result<Preferences, ProsaError> {
    data::get_user(pool, user_id).await?;
    let preferences = data::get_preferences(pool, user_id).await?;
    Ok(preferences)
}

pub async fn update_preferences(
    pool: &SqlitePool,
    user_id: &str,
    preferences: Preferences,
) -> Result<(), ProsaError> {
    data::get_user(pool, user_id).await?;

    if preferences.automatic_metadata.is_none() {
        return Err(PreferencesError::MissingAutomaticMetadata.into());
    }

    if preferences.metadata_providers.is_none() {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    data::update_preferences(pool, user_id, preferences).await?;
    Ok(())
}

pub async fn patch_preferences(
    pool: &SqlitePool,
    user_id: &str,
    mut preferences: Preferences,
) -> Result<(), ProsaError> {
    data::get_user(pool, user_id).await?;

    if preferences.automatic_metadata.is_none() && preferences.metadata_providers.is_none() {
        return Err(PreferencesError::InvalidPreferences.into());
    }

    let original = data::get_preferences(pool, user_id).await?;
    preferences.merge(original);

    if preferences.automatic_metadata.is_none() {
        return Err(PreferencesError::MissingAutomaticMetadata.into());
    }

    data::update_preferences(pool, user_id, preferences).await?;
    Ok(())
}

fn verify_username(username: &str) -> Result<(), UserError> {
    let filter = Regex::new(r"^[\w.!@-]+$").unwrap();
    if !filter.is_match(username) {
        return Err(UserError::InvalidInput);
    }

    if username.len() > 20 {
        return Err(UserError::UsernameTooBig);
    }

    Ok(())
}

fn verify_password(password: &str) -> Result<(), UserError> {
    let filter = Regex::new(r"^[\w.!@#$%^&*-]+$").unwrap();
    if !filter.is_match(password) {
        return Err(UserError::InvalidInput);
    }

    if password.len() > 256 {
        return Err(UserError::PasswordTooBig);
    }

    Ok(())
}
