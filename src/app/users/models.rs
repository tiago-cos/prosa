use std::collections::HashMap;

use chrono::{DateTime, Utc};
use merge::Merge;
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

    #[strum(message = "Username must not exceed 20 characters.")]
    #[strum(props(StatusCode = "400"))]
    UsernameTooBig,

    #[strum(message = "Password must not exceed 256 characters.")]
    #[strum(props(StatusCode = "400"))]
    PasswordTooBig,

    #[strum(message = "The provided user id is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidUserId,

    #[strum(message = "The provided user id is already in use.")]
    #[strum(props(StatusCode = "409"))]
    UserIdConflict,

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
pub enum PreferencesError {
    #[strum(message = "Invalid or unsupported metadata provider selection.")]
    #[strum(props(StatusCode = "400"))]
    InvalidMetadataProvider,

    #[strum(message = "Automatic metadata preference must be present.")]
    #[strum(props(StatusCode = "400"))]
    MissingAutomaticMetadata,

    #[strum(message = "Invalid or unsupported preferences provided.")]
    #[strum(props(StatusCode = "400"))]
    InvalidPreferences,

    #[strum(message = "This metadata provider requires an API key.")]
    #[strum(props(StatusCode = "400"))]
    MissingProviderKey,

    #[strum(message = "The same metadata provider must not be selected more than once.")]
    #[strum(props(StatusCode = "400"))]
    DuplicateMetadataProvider,

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
#[allow(unused)]
pub struct User {
    pub user_id: String,
    pub username: String,
    pub password_hash: String,
    pub is_admin: bool,
}

#[derive(Deserialize)]
pub struct RegisterUserRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub admin: bool,
    pub user_id: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginUserRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

pub const PROVIDERS: [(&str, bool); 4] = [
    ("epub_metadata_extractor", false),
    ("openlibrary", false),
    ("hardcover", true),
    ("google_books", true),
];

pub const DEFAULT_PROVIDER: &str = "epub_metadata_extractor";

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Merge, Default)]
#[merge(strategy = merge::option::overwrite_none)]
pub struct Preferences {
    pub metadata_providers: Option<Vec<String>>,
    /// Keys to store, by provider. Write-only: a provider mapped to `null`
    /// has its key cleared, one left out keeps whatever is already stored.
    #[serde(skip_serializing)]
    pub provider_keys: Option<HashMap<String, Option<String>>>,
    /// Providers that currently have a key stored. Read-only.
    #[serde(skip_deserializing)]
    pub configured_providers: Option<Vec<String>>,
    pub automatic_metadata: Option<bool>,
}

#[derive(FromRow)]
pub struct ApiKey {
    pub key_id: String,
    pub user_id: String,
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
    pub expires_at: Option<i64>,
}

#[derive(Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub capabilities: Vec<String>,
    pub expires_at: Option<i64>,
    pub key_id: Option<String>,
}

#[derive(Serialize)]
pub struct CreateApiKeyResponse {
    pub id: String,
    pub key: String,
}

#[derive(Serialize)]
pub struct AuthenticationResponse {
    pub jwt_token: String,
    pub refresh_token: String,
    pub user_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct UserProfile {
    pub username: String,
}
