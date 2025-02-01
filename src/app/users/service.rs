use super::{
    data,
    models::{ApiKey, User, UserError},
};
use crate::app::{
    authentication::{self, service::hash_secret},
    error::ProsaError,
};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn register_user(
    pool: &SqlitePool,
    username: &str,
    password: &str,
    is_admin: bool,
) -> Result<(), UserError> {
    let password_hash = hash_secret(password).await;
    data::add_user(pool, username, &password_hash, is_admin).await?;

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
    let key_id = Uuid::new_v4().to_string();
    let (key, hash) = authentication::service::generate_api_key().await;

    data::add_api_key(pool, &key_id, username, &hash, key_name, expiration, capabilities).await?;
    Ok((key_id, key))
}

pub async fn get_api_key(pool: &SqlitePool, username: &str, key_id: &str) -> Result<ApiKey, ProsaError> {
    let key = data::get_api_key(pool, username, key_id).await?;
    Ok(key)
}
