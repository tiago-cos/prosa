use strum_macros::{EnumMessage, EnumProperty};

type FileError = std::io::Error;
type FileErrorKind = std::io::ErrorKind;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum CoverError {
    #[strum(message = "The requested cover does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    CoverNotFound,
    #[strum(message = "This book already has a cover.")]
    #[strum(props(StatusCode = "409"))]
    CoverConflict,
    #[strum(message = "The provided cover image is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidCover,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<FileError> for CoverError {
    fn from(error: FileError) -> Self {
        match error.kind() {
            FileErrorKind::NotFound => CoverError::CoverNotFound,
            _ => CoverError::InternalError,
        }
    }
}
