use strum_macros::{EnumMessage, EnumProperty};

type FileError = std::io::Error;
type FileErrorKind = std::io::ErrorKind;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum CoverError {
    #[strum(message = "Cover with that ID was not found")]
    #[strum(props(StatusCode = "404"))]
    CoverNotFound,
    #[strum(message = "The given cover already exists")]
    #[strum(props(StatusCode = "409"))]
    CoverConflict,
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
