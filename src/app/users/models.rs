use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use sqlx::{error::DatabaseError, prelude::FromRow, sqlite::SqliteError};
use strum_macros::{EnumMessage, EnumProperty};

type SqlxError = sqlx::error::Error;
type SqlxErrorKind = sqlx::error::ErrorKind;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum UserError {
    #[strum(message = "The username is already taken.")]
    #[strum(props(StatusCode = "409"))]
    UserConflict,

    #[strum(message = "The requested user does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    UserNotFound,

    #[strum(message = "Invalid credentials provided.")]
    #[strum(props(StatusCode = "403"))]
    InvalidCredentials,

    #[strum(message = "Username and password must not contain special characters.")]
    #[strum(props(StatusCode = "400"))]
    InvalidInput,

    #[strum(message = "Internal server error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for UserError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::RowNotFound => UserError::UserNotFound,
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => UserError::InternalError,
        }
    }
}

impl From<&SqliteError> for UserError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            SqlxErrorKind::UniqueViolation => UserError::UserConflict,
            _ => UserError::InternalError,
        }
    }
}

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum ApiKeyError {
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

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum PreferencesError {
    #[strum(message = "Invalid or unsupported metadata provider selection.")]
    #[strum(props(StatusCode = "400"))]
    InvalidMetadataProvider,

    #[strum(message = "The requested user does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    UserNotFound,

    #[strum(message = "Internal server error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for PreferencesError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => PreferencesError::InternalError,
        }
    }
}

impl From<&SqliteError> for PreferencesError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            SqlxErrorKind::UniqueViolation => PreferencesError::InvalidMetadataProvider,
            SqlxErrorKind::CheckViolation => PreferencesError::InvalidMetadataProvider,
            SqlxErrorKind::Other => PreferencesError::InvalidMetadataProvider,
            SqlxErrorKind::ForeignKeyViolation => PreferencesError::UserNotFound,
            _ => PreferencesError::InternalError,
        }
    }
}

#[derive(FromRow)]
pub struct User {
    pub user_id: String,
    pub password_hash: String,
    pub is_admin: bool,
}

#[derive(Deserialize)]
pub struct RegisterUserRequest {
    pub username: String,
    pub password: String,
    pub admin_key: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginUserRequest {
    pub password: String,
}

pub const EPUB_PROVIDER: &str = "epub_metadata_extractor";
pub const GOODREADS_PROVIDER: &str = "goodreads_metadata_scraper";

#[derive(FromRow, Serialize, Deserialize)]
pub struct Preferences {
    pub metadata_providers: Vec<String>,
}

#[derive(FromRow)]
pub struct ApiKey {
    pub key_id: String,
    pub user_id: String,
    pub key_hash: String,
    pub name: String,
    pub expiration: Option<DateTime<Utc>>,
    #[sqlx(skip)]
    pub capabilities: Vec<String>,
}

#[skip_serializing_none]
#[derive(Serialize)]
pub struct GetApiKeyResponse {
    pub name: String,
    pub capabilities: Vec<String>,
    pub expires_at: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub capabilities: Vec<String>,
    pub expires_at: Option<String>,
}

#[derive(Serialize)]
pub struct CreateApiKeyResponse {
    pub id: String,
    pub key: String,
}
