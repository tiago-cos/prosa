use super::models::{AuthError, AuthRole, AuthToken, AuthType, JWTClaims, CAPABILITIES};
use crate::app::users;
use argon2::{
    password_hash::{
        rand_core::{OsRng, RngCore},
        SaltString,
    },
    Argon2, PasswordHasher,
};
use base64::{prelude::BASE64_STANDARD, Engine};
use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::time::{SystemTime, UNIX_EPOCH};

#[rustfmt::skip]
pub async fn generate_jwt(secret: &str, username: String, is_admin: bool, duration: &u64) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Failed to get time since epoch")
        .as_secs();

    let capabilities = CAPABILITIES.iter().map(|&s| s.to_string()).collect();
    let role = if is_admin { AuthRole::Admin(username) } else { AuthRole::User(username) };
    let claims = JWTClaims { role, capabilities, exp: now + duration };

    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .expect("Failed to encode token");

    BASE64_STANDARD.encode(token)
}

pub async fn generate_api_key() -> (String, String) {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    let encoded_key = BASE64_STANDARD.encode(key);
    let hash = BASE64_STANDARD.encode(Sha256::digest(&key));

    (encoded_key, hash)
}

pub async fn verify_jwt(token: &str, secret: &str) -> Result<AuthToken, AuthError> {
    let token = BASE64_STANDARD.decode(token).or(Err(AuthError::InvalidToken))?;
    let token = String::from_utf8(token).expect("Failed to convert token to string");
    let key = DecodingKey::from_secret(secret.as_ref());
    let validation = Validation::default();
    let token = jsonwebtoken::decode::<JWTClaims>(&token, &key, &validation)?;

    let token = AuthToken {
        role: token.claims.role,
        capabilities: token.claims.capabilities,
        auth_type: AuthType::JWT,
    };

    Ok(token)
}

pub async fn verify_api_key(pool: &SqlitePool, key: &str) -> Result<AuthToken, AuthError> {
    let key = BASE64_STANDARD.decode(key).or(Err(AuthError::InvalidKey))?;
    let hash = BASE64_STANDARD.encode(Sha256::digest(&key));
    let key = users::data::get_api_key_by_hash(pool, &hash)
        .await
        .ok_or(AuthError::InvalidKey)?;
    let user = users::data::get_user(pool, &key.user_id)
        .await
        .or(Err(AuthError::InvalidKey))?;

    // Return error if expired
    if key.expiration.filter(|date| date >= &Utc::now()) != key.expiration {
        return Err(AuthError::InvalidKey);
    }

    let role = match user.is_admin {
        true => AuthRole::Admin(user.user_id),
        false => AuthRole::User(user.user_id),
    };

    Ok(AuthToken {
        role,
        capabilities: key.capabilities,
        auth_type: AuthType::ApiKey,
    })
}

pub async fn hash_secret(secret: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(secret.as_bytes(), &salt)
        .expect("Failed to hash password")
        .to_string()
}
