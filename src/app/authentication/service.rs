use super::models::{AuthRole, AuthToken, AuthType, CAPABILITIES, JWTClaims};
use crate::app::{
    authentication::{
        models::{ApiKeyError, AuthError, AuthTokenError, RefreshToken},
        repository::AuthenticationRepository,
    },
    error::ProsaError,
    users::repository::UserRepository,
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
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::Path,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

pub struct AuthenticationService {
    authentication_repository: Arc<AuthenticationRepository>,
    user_repository: Arc<UserRepository>,
    jwt_secret: Vec<u8>,
    jwt_duration: u64,
    refresh_token_duration: u64,
    admin_key: String,
    allowed_registration: bool,
}

impl AuthenticationService {
    pub fn new(
        authentication_repository: Arc<AuthenticationRepository>,
        user_repository: Arc<UserRepository>,
        jwt_key_path: &str,
        jwt_duration: u64,
        refresh_token_duration: u64,
        admin_key: &str,
        allowed_registration: bool,
    ) -> Self {
        let jwt_secret = generate_jwt_secret(jwt_key_path);
        Self {
            authentication_repository,
            user_repository,
            jwt_secret,
            jwt_duration,
            refresh_token_duration,
            admin_key: admin_key.to_string(),
            allowed_registration,
        }
    }

    #[rustfmt::skip]
    pub fn generate_jwt(&self, user_id: &str, session_id: &str, is_admin: bool) -> String {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Failed to get time since epoch")
            .as_secs();

        let capabilities = CAPABILITIES.iter().map(|&s| s.to_string()).collect();
        let role = if is_admin { AuthRole::Admin(user_id.to_string()) } else { AuthRole::User(user_id.to_string()) };
        let claims = JWTClaims { role, capabilities, exp: now + self.jwt_duration, session_id: session_id.to_string() };

        let token = jsonwebtoken::encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.jwt_secret),
        )
        .expect("Failed to encode token");

        BASE64_STANDARD.encode(token)
    }

    pub async fn generate_api_key(
        &self,
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

        self.authentication_repository
            .add_api_key(&key_id, user_id, &key_hash, key_name, expiration, capabilities)
            .await?;

        Ok((key_id, encoded_key))
    }

    pub async fn generate_refresh_token(&self, user_id: &str, session_id: &str) -> String {
        let mut token = [0u8; 128];
        OsRng.fill_bytes(&mut token);
        let encoded_token = BASE64_STANDARD.encode(token);
        let hash = BASE64_STANDARD.encode(Sha256::digest(token));

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Failed to get time since epoch")
            .as_secs();
        let expiration: i64 = (now + self.refresh_token_duration)
            .try_into()
            .expect("Failed to convert timestamp");
        let expiration =
            DateTime::<Utc>::from_timestamp(expiration, 0).expect("Failed to obtain current timestamp");

        self.authentication_repository
            .add_refresh_token(user_id, session_id, &hash, expiration)
            .await;

        encoded_token
    }

    pub fn verify_jwt(&self, token: &str) -> Result<AuthToken, AuthTokenError> {
        let token = BASE64_STANDARD
            .decode(token)
            .or(Err(AuthTokenError::InvalidToken))?;
        let token = String::from_utf8(token).or(Err(AuthTokenError::InvalidToken))?;
        let key = DecodingKey::from_secret(&self.jwt_secret);
        let validation = Validation::default();
        let token = jsonwebtoken::decode::<JWTClaims>(&token, &key, &validation)?;

        Ok(AuthToken {
            role: token.claims.role,
            capabilities: token.claims.capabilities,
            auth_type: AuthType::Jwt,
            session_id: token.claims.session_id,
        })
    }

    pub async fn verify_api_key(&self, key: &str) -> Result<AuthToken, ApiKeyError> {
        let key = BASE64_STANDARD.decode(key).or(Err(ApiKeyError::InvalidKey))?;
        let hash = BASE64_STANDARD.encode(Sha256::digest(&key));
        let key = self
            .authentication_repository
            .get_api_key_by_hash(&hash)
            .await
            .ok_or(ApiKeyError::InvalidKey)?;
        let user = self
            .user_repository
            .get_user(&key.user_id)
            .await
            .or(Err(ApiKeyError::InvalidKey))?;

        // Return error if expired
        if key.expiration.filter(|date| date >= &Utc::now()) != key.expiration {
            self.authentication_repository
                .delete_api_key(&key.user_id, &key.key_id)
                .await?;
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

    //TODO check that user refresh tokens are deleted when we delete a user

    pub async fn renew_refresh_token(&self, token: &str) -> Result<(RefreshToken, String), AuthTokenError> {
        let token = BASE64_STANDARD
            .decode(token)
            .or(Err(AuthTokenError::InvalidToken))?;
        let hash = BASE64_STANDARD.encode(Sha256::digest(&token));
        let token = self
            .authentication_repository
            .get_refresh_token_by_hash(&hash)
            .await
            .ok_or(AuthTokenError::InvalidToken)?;

        self.authentication_repository.delete_refresh_token(&hash).await?;

        // Return error if expired
        if token.expiration < Utc::now() {
            return Err(AuthTokenError::ExpiredToken);
        }

        let encoded_token = self
            .generate_refresh_token(&token.user_id, &token.session_id)
            .await;

        Ok((token, encoded_token))
    }

    pub async fn invalidate_refresh_token(&self, token: &str) -> Result<(), AuthTokenError> {
        let token = BASE64_STANDARD
            .decode(token)
            .or(Err(AuthTokenError::InvalidToken))?;
        let hash = BASE64_STANDARD.encode(Sha256::digest(&token));

        self.authentication_repository.delete_refresh_token(&hash).await?;
        Ok(())
    }

    pub async fn revoke_api_key(&self, user_id: &str, key_id: &str) -> Result<(), ProsaError> {
        self.authentication_repository
            .delete_api_key(user_id, key_id)
            .await?;
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

    pub fn can_register(&self, as_admin: bool, admin_key: Option<&str>) -> Result<(), AuthError> {
        if let Some(key) = admin_key
            && key == self.admin_key
        {
            return Ok(());
        }

        if let Some(key) = admin_key
            && key != self.admin_key
        {
            return Err(AuthError::InvalidAdminKey);
        }

        if !self.allowed_registration {
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
}

fn generate_jwt_secret(secret_key_path: &str) -> Vec<u8> {
    if Path::new(secret_key_path).exists() {
        return fs::read(secret_key_path).expect("Failed to read JWT secret file");
    }

    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    fs::write(secret_key_path, key).expect("Failed to write JWT secret file");
    key.to_vec()
}
