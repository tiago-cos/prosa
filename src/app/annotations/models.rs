use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use sqlx::{
    error::{DatabaseError, ErrorKind},
    prelude::FromRow,
    sqlite::SqliteError,
};
use strum_macros::{EnumMessage, EnumProperty};

use crate::app::error::unmapped;

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
    #[strum(message = "The provided annotation id is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidAnnotationId,
    #[strum(message = "The provided annotation id is already in use.")]
    #[strum(props(StatusCode = "409"))]
    AnnotationIdConflict,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for AnnotationError {
    fn from(error: SqlxError) -> Self {
        match &error {
            SqlxError::RowNotFound => AnnotationError::AnnotationNotFound,
            SqlxError::Database(database) => database.downcast_ref::<SqliteError>().into(),
            _ => unmapped(&error, AnnotationError::InternalError),
        }
    }
}

impl From<&SqliteError> for AnnotationError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => AnnotationError::AnnotationConflict,
            _ => unmapped(error, AnnotationError::InternalError),
        }
    }
}

#[skip_serializing_none]
#[derive(FromRow, Serialize)]
pub struct Annotation {
    pub annotation_id: String,
    pub start_location: String,
    pub end_location: String,
    pub note: Option<String>,
}

#[derive(Deserialize)]
pub struct NewAnnotationRequest {
    pub start_location: String,
    pub end_location: String,
    pub note: Option<String>,
    pub annotation_id: Option<String>,
}

#[derive(Deserialize)]
pub struct PatchAnnotationRequest {
    pub note: Option<String>,
}
