use strum_macros::{EnumMessage, EnumProperty};

type FileError = std::io::Error;
type FileErrorKind = std::io::ErrorKind;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum EpubError {
    #[strum(message = "The provided EPUB data is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidEpub,
    #[strum(message = "The requested EPUB does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    EpubNotFound,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<FileError> for EpubError {
    fn from(error: FileError) -> Self {
        match error.kind() {
            FileErrorKind::NotFound => EpubError::EpubNotFound,
            _ => EpubError::InternalError,
        }
    }
}
