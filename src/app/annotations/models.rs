use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use sqlx::{
    error::{DatabaseError, ErrorKind},
    prelude::FromRow,
    sqlite::SqliteError,
};
use strum_macros::{EnumMessage, EnumProperty};

type SqlxError = sqlx::Error;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum AnnotationError {
    #[strum(message = "The provided annotation is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidAnnotation,
    #[strum(message = "The requested annotation does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    AnnotationNotFound,
    #[strum(message = "An annotation in this position already exists.")]
    #[strum(props(StatusCode = "409"))]
    AnnotationConflict,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for AnnotationError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::RowNotFound => AnnotationError::AnnotationNotFound,
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => AnnotationError::InternalError,
        }
    }
}

impl From<&SqliteError> for AnnotationError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => AnnotationError::AnnotationConflict,
            _ => AnnotationError::InternalError,
        }
    }
}

#[skip_serializing_none]
#[derive(FromRow, Serialize)]
pub struct Annotation {
    pub annotation_id: String,
    pub source: String,
    pub start_tag: String,
    pub end_tag: String,
    pub start_char: u32,
    pub end_char: u32,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct NewAnnotationRequest {
    pub source: String,
    pub start_tag: String,
    pub end_tag: String,
    pub start_char: u32,
    pub end_char: u32,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct PatchAnnotationRequest {
    pub note: Option<String>,
}
