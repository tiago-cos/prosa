use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::error::DatabaseError;
use sqlx::{FromRow, sqlite::SqliteError};
use strum_macros::{EnumMessage, EnumProperty};

type JwtError = jsonwebtoken::errors::Error;
type JwtErrorKind = jsonwebtoken::errors::ErrorKind;
type SqlxError = sqlx::error::Error;
type SqlxErrorKind = sqlx::error::ErrorKind;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum AuthError {
    #[strum(message = "No authentication was provided.")]
    #[strum(props(StatusCode = "401"))]
    MissingAuth,

    #[strum(message = "The authentication header is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidAuthHeader,

    #[strum(message = "Forbidden.")]
    #[strum(props(StatusCode = "403"))]
    Forbidden,

    #[strum(message = "Registration without admin key is disabled.")]
    #[strum(props(StatusCode = "403"))]
    RegistrationDisabled,

    #[strum(message = "The provided admin key is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidAdminKey,

    #[strum(message = "No admin key was provided.")]
    #[strum(props(StatusCode = "400"))]
    MissingAdminKey,
}

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum AuthTokenError {
    #[strum(message = "The provided token is expired.")]
    #[strum(props(StatusCode = "401"))]
    ExpiredToken,

    #[strum(message = "The provided token is invalid.")]
    #[strum(props(StatusCode = "401"))]
    InvalidToken,

    #[strum(message = "The refresh token was not found or cannot be accessed.")]
    #[strum(props(StatusCode = "404"))]
    MissingToken,

    #[strum(message = "The provided signature is invalid.")]
    #[strum(props(StatusCode = "401"))]
    InvalidSignature,

    #[strum(message = "Internal server error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum ApiKeyError {
    #[strum(message = "The provided API key is invalid.")]
    #[strum(props(StatusCode = "401"))]
    InvalidKey,

    #[strum(message = "Invalid or unsupported capabilities provided.")]
    #[strum(props(StatusCode = "400"))]
    InvalidCapabilities,

    #[strum(message = "Expiration timestamp is invalid or incorrectly formatted.")]
    #[strum(props(StatusCode = "400"))]
    InvalidTimestamp,

    #[strum(message = "The requested key does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    KeyNotFound,

    #[strum(message = "The requested user does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    UserNotFound,

    #[strum(message = "Internal server error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<JwtError> for AuthTokenError {
    fn from(err: JwtError) -> Self {
        match err.kind() {
            JwtErrorKind::ExpiredSignature => AuthTokenError::ExpiredToken,
            JwtErrorKind::InvalidToken => AuthTokenError::InvalidToken,
            JwtErrorKind::InvalidSignature => AuthTokenError::InvalidSignature,
            _ => AuthTokenError::InternalError,
        }
    }
}

impl From<SqlxError> for ApiKeyError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::RowNotFound => ApiKeyError::KeyNotFound,
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => ApiKeyError::InternalError,
        }
    }
}

impl From<&SqliteError> for ApiKeyError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            SqlxErrorKind::UniqueViolation => ApiKeyError::InvalidCapabilities,
            SqlxErrorKind::CheckViolation => ApiKeyError::InvalidCapabilities,
            SqlxErrorKind::Other => ApiKeyError::InvalidCapabilities,
            SqlxErrorKind::ForeignKeyViolation => ApiKeyError::UserNotFound,
            _ => ApiKeyError::InternalError,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum AuthRole {
    Admin(String),
    User(String),
}

impl AuthRole {
    pub fn get_user(&self) -> &str {
        match self {
            AuthRole::User(s) | AuthRole::Admin(s) => s,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum AuthType {
    Jwt,
    ApiKey,
}

pub const READ: &str = "Read";
pub const CREATE: &str = "Create";
pub const DELETE: &str = "Delete";
pub const UPDATE: &str = "Update";

pub const CAPABILITIES: [&str; 4] = [READ, CREATE, DELETE, UPDATE];

#[derive(Serialize, Deserialize, Clone)]
pub struct JWTClaims {
    pub role: AuthRole,
    pub capabilities: Vec<String>,
    pub exp: u64,
}

#[derive(Clone)]
pub struct AuthToken {
    pub role: AuthRole,
    pub capabilities: Vec<String>,
    pub auth_type: AuthType,
}

#[derive(FromRow)]
#[allow(unused)]
pub struct RefreshToken {
    pub user_id: String,
    pub refresh_token_hash: String,
    pub expiration: DateTime<Utc>,
}
