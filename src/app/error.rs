use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use log::error;
use std::fmt::{Debug, Display};
use std::str::FromStr;
use strum::{EnumMessage, EnumProperty};

pub trait ProsaErrorTrait: EnumMessage + EnumProperty + Debug + Send + Sync {}
impl<T> ProsaErrorTrait for T where T: EnumMessage + EnumProperty + Debug + Send + Sync {}
pub type ProsaError = Box<dyn ProsaErrorTrait>;

impl<T> From<T> for ProsaError
where
    T: ProsaErrorTrait + 'static,
{
    fn from(value: T) -> Self {
        Box::new(value)
    }
}

pub fn unmapped<E>(error: &dyn Display, reported: E) -> E {
    error!("Unhandled database error: {error}");
    reported
}

impl IntoResponse for ProsaError {
    fn into_response(self) -> Response {
        let message = self.get_message().expect("Failed to extract message from error");

        let status_code = self
            .get_str("StatusCode")
            .expect("Failed to extract status code from error");

        let status_code = StatusCode::from_str(status_code).expect("Failed to parse status code from error");

        (status_code, message).into_response()
    }
}
