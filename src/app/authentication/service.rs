use super::models::{AuthRole, AuthToken, AuthType, CAPABILITIES, JWTClaims};
use crate::{
    CONFIG,
    app::{
        authentication::{
            models::{ApiKeyError, AuthError, AuthTokenError, RefreshToken},
            repository,
        },
        error::ProsaError,
        users,
    },
};
use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{
        SaltString,
        rand_core::{OsRng, RngCore},
    },
};
use base64::{Engine, prelude::BASE64_STANDARD};
use chrono::{DateTime, Utc};
use jsonwebtoken::{
    Algorithm, DecodingKey, EncodingKey, Header, Validation,
    jwk::{Jwk, JwkSet},
};
use rsa::{
    RsaPrivateKey,
    pkcs1::{EncodeRsaPrivateKey, EncodeRsaPublicKey},
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::Path,
    sync::LazyLock,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

static ENCODING_KEY: LazyLock<EncodingKey> = LazyLock::new(|| load_or_generate_rsa_keys().0);
static DECODING_KEY: LazyLock<DecodingKey> = LazyLock::new(|| load_or_generate_rsa_keys().1);

#[rustfmt::skip]
pub fn generate_jwt( user_id: &str, session_id: &str, is_admin: bool) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Failed to get time since epoch")
        .as_secs();

    let capabilities = CAPABILITIES.iter().map(|&s| s.to_string()).collect();
    let role = if is_admin { AuthRole::Admin(user_id.to_string()) } else { AuthRole::User(user_id.to_string()) };
    let claims = JWTClaims { 
        role, 
        capabilities, exp: now + CONFIG.auth.jwt_token_duration, 
        session_id: session_id.to_string(), 
        iss: "prosa".to_string(), 
    };

    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some("prosa-key-1".to_string());

    let token = jsonwebtoken::encode(
        &header,
        &claims,
        &ENCODING_KEY,
    )
    .expect("Failed to encode token");

    BASE64_STANDARD.encode(token)
}

pub async fn generate_api_key(
    user_id: &str,
    key_name: &str,
    expiration: Option<i64>,
    capabilities: Vec<String>,
) -> Result<(String, String), ApiKeyError> {
    if capabilities.is_empty() {
        return Err(ApiKeyError::InvalidCapabilities);
    }

    let expiration = expiration
        .map(DateTime::<Utc>::from_timestamp_millis)
        .map(|result| result.ok_or(ApiKeyError::InvalidTimestamp))
        .transpose()?;

    if expiration.filter(|date| date >= &Utc::now()) != expiration {
        return Err(ApiKeyError::InvalidTimestamp);
    }

    let key_id = Uuid::new_v4().to_string();
    let mut key_bytes = [0u8; 32];
    OsRng.fill_bytes(&mut key_bytes);
    let key_hash = BASE64_STANDARD.encode(Sha256::digest(key_bytes));
    let encoded_key = BASE64_STANDARD.encode(key_bytes);

    repository::add_api_key(&key_id, user_id, &key_hash, key_name, expiration, capabilities).await?;

    Ok((key_id, encoded_key))
}

pub async fn generate_refresh_token(user_id: &str, session_id: &str) -> String {
    let mut token = [0u8; 128];
    OsRng.fill_bytes(&mut token);
    let encoded_token = BASE64_STANDARD.encode(token);
    let hash = BASE64_STANDARD.encode(Sha256::digest(token));

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Failed to get time since epoch")
        .as_secs();
    let expiration: i64 = (now + CONFIG.auth.refresh_token_duration)
        .try_into()
        .expect("Failed to convert timestamp");
    let expiration =
        DateTime::<Utc>::from_timestamp(expiration, 0).expect("Failed to obtain current timestamp");

    repository::add_refresh_token(user_id, session_id, &hash, expiration).await;

    encoded_token
}

pub fn verify_jwt(token: &str) -> Result<AuthToken, AuthTokenError> {
    let token = BASE64_STANDARD
        .decode(token)
        .or(Err(AuthTokenError::InvalidToken))?;
    let token = String::from_utf8(token).or(Err(AuthTokenError::InvalidToken))?;
    let validation = Validation::new(Algorithm::RS256);
    let token = jsonwebtoken::decode::<JWTClaims>(&token, &DECODING_KEY, &validation)?;

    Ok(AuthToken {
        role: token.claims.role,
        capabilities: token.claims.capabilities,
        auth_type: AuthType::Jwt,
        session_id: token.claims.session_id,
    })
}

pub async fn verify_api_key(key: &str) -> Result<AuthToken, ApiKeyError> {
    let key = BASE64_STANDARD.decode(key).or(Err(ApiKeyError::InvalidKey))?;
    let hash = BASE64_STANDARD.encode(Sha256::digest(&key));
    let key = repository::get_api_key_by_hash(&hash)
        .await
        .ok_or(ApiKeyError::InvalidKey)?;
    let user = users::repository::get_user(&key.user_id)
        .await
        .or(Err(ApiKeyError::InvalidKey))?;

    // Return error if expired
    if key.expiration.filter(|date| date >= &Utc::now()) != key.expiration {
        repository::delete_api_key(&key.user_id, &key.key_id).await?;
        return Err(ApiKeyError::InvalidKey);
    }

    let role = if user.is_admin {
        AuthRole::Admin(user.user_id)
    } else {
        AuthRole::User(user.user_id)
    };

    Ok(AuthToken {
        role,
        capabilities: key.capabilities,
        auth_type: AuthType::ApiKey,
        session_id: key.key_id, // each API key counts as a session
    })
}

pub async fn renew_refresh_token(token: &str) -> Result<(RefreshToken, String), AuthTokenError> {
    let token = BASE64_STANDARD
        .decode(token)
        .or(Err(AuthTokenError::InvalidToken))?;
    let hash = BASE64_STANDARD.encode(Sha256::digest(&token));
    let token = repository::get_refresh_token_by_hash(&hash)
        .await
        .ok_or(AuthTokenError::InvalidToken)?;

    repository::delete_refresh_token(&hash).await?;

    // Return error if expired
    if token.expiration < Utc::now() {
        return Err(AuthTokenError::ExpiredToken);
    }

    let encoded_token = generate_refresh_token(&token.user_id, &token.session_id).await;

    Ok((token, encoded_token))
}

pub async fn invalidate_refresh_token(token: &str) -> Result<(), AuthTokenError> {
    let token = BASE64_STANDARD
        .decode(token)
        .or(Err(AuthTokenError::InvalidToken))?;
    let hash = BASE64_STANDARD.encode(Sha256::digest(&token));

    repository::delete_refresh_token(&hash).await?;
    Ok(())
}

pub async fn revoke_api_key(user_id: &str, key_id: &str) -> Result<(), ProsaError> {
    repository::delete_api_key(user_id, key_id).await?;
    Ok(())
}

pub fn hash_secret(secret: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(secret.as_bytes(), &salt)
        .expect("Failed to hash password")
        .to_string()
}

pub fn verify_secret(hash: &str, secret: &str) -> bool {
    let Ok(password_hash) = PasswordHash::new(hash) else {
        return false;
    };

    Argon2::default()
        .verify_password(secret.as_bytes(), &password_hash)
        .is_ok()
}

pub fn can_register(as_admin: bool, admin_key: Option<&str>) -> Result<(), AuthError> {
    if let Some(key) = admin_key
        && key == CONFIG.auth.admin_key
    {
        return Ok(());
    }

    if let Some(key) = admin_key
        && key != CONFIG.auth.admin_key
    {
        return Err(AuthError::InvalidAdminKey);
    }

    if !CONFIG.auth.allow_user_registration {
        return Err(AuthError::RegistrationDisabled);
    }

    if !as_admin {
        return Ok(());
    }

    Err(AuthError::MissingAdminKey)
}

pub fn generate_new_session() -> String {
    Uuid::new_v4().to_string()
}

pub fn generate_jwks() -> JwkSet {
    let mut jwk = Jwk::from_encoding_key(&ENCODING_KEY, Algorithm::RS256)
        .expect("Failed to convert decoding key to JWK");
    jwk.common.key_id = Some("prosa-key-1".to_string());

    JwkSet { keys: vec![jwk] }
}

fn load_or_generate_rsa_keys() -> (EncodingKey, DecodingKey) {
    if Path::new(&CONFIG.auth.private_key_path).exists() && Path::new(&CONFIG.auth.public_key_path).exists() {
        let private = fs::read(&CONFIG.auth.private_key_path).expect("Failed to read JWT private key");
        let public = fs::read(&CONFIG.auth.public_key_path).expect("Failed to read JWT public key");

        return (
            EncodingKey::from_rsa_der(&private),
            DecodingKey::from_rsa_der(&public),
        );
    }

    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048).expect("Failed to generate RSA key");

    let private_der = private_key
        .to_pkcs1_der()
        .expect("Failed to encode private key")
        .to_bytes();

    let public_der = private_key
        .to_public_key()
        .to_pkcs1_der()
        .expect("Failed to encode public key")
        .into_vec();

    fs::write(&CONFIG.auth.private_key_path, &private_der).expect("Failed to write JWT private key");
    fs::write(&CONFIG.auth.public_key_path, &public_der).expect("Failed to write JWT public key");

    let encoding_key = EncodingKey::from_rsa_der(&private_der);
    let decoding_key = DecodingKey::from_rsa_der(&public_der);

    (encoding_key, decoding_key)
}
