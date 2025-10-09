use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use strum_macros::{EnumMessage, EnumProperty};

type JwtError = jsonwebtoken::errors::Error;
type JwtErrorKind = jsonwebtoken::errors::ErrorKind;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum AuthError {
    #[strum(message = "The provided token is expired.")]
    #[strum(props(StatusCode = "401"))]
    ExpiredToken,

    #[strum(message = "The provided token is invalid.")]
    #[strum(props(StatusCode = "401"))]
    InvalidToken,

    #[strum(message = "The refresh token was not found or cannot be accessed.")]
    #[strum(props(StatusCode = "404"))]
    MissingToken,

    #[strum(message = "The provided API key is invalid.")]
    #[strum(props(StatusCode = "401"))]
    InvalidKey,

    #[strum(message = "The provided signature is invalid.")]
    #[strum(props(StatusCode = "401"))]
    InvalidSignature,

    #[strum(message = "No authentication was provided.")]
    #[strum(props(StatusCode = "401"))]
    MissingAuth,

    #[strum(message = "The authentication header is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidAuthHeader,

    #[strum(message = "Forbidden.")]
    #[strum(props(StatusCode = "403"))]
    Forbidden,

    #[strum(message = "Internal server error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<JwtError> for AuthError {
    fn from(err: JwtError) -> Self {
        match err.kind() {
            JwtErrorKind::ExpiredSignature => AuthError::ExpiredToken,
            JwtErrorKind::InvalidToken => AuthError::InvalidToken,
            JwtErrorKind::InvalidSignature => AuthError::InvalidSignature,
            _ => AuthError::InternalError,
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
