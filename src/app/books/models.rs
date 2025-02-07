use axum::body::Bytes;
use axum_typed_multipart::TryFromMultipart;
use sqlx::{
    error::{DatabaseError, ErrorKind},
    sqlite::SqliteError,
    FromRow,
};
use strum_macros::{EnumMessage, EnumProperty};

type SqlxError = sqlx::Error;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum BookError {
    #[strum(message = "The requested book was not found")]
    #[strum(props(StatusCode = "404"))]
    BookNotFound,
    #[strum(message = "This book already exists in your library")]
    #[strum(props(StatusCode = "409"))]
    BookConflict,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for BookError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::RowNotFound => BookError::BookNotFound,
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => BookError::InternalError,
        }
    }
}

impl From<&SqliteError> for BookError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => BookError::BookConflict,
            _ => BookError::InternalError,
        }
    }
}

#[derive(FromRow)]
pub struct Book {
    pub owner_id: String,
    pub epub_id: String,
    pub metadata_id: Option<String>,
    pub cover_id: Option<String>,
    pub state_id: String,
    pub sync_id: String,
}

#[derive(TryFromMultipart)]
pub struct UploadBoodRequest {
    pub owner_id: String,
    #[form_data(limit = "30MiB")]
    pub epub: Bytes,
}
