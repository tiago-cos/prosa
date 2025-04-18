use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use strum_macros::{EnumMessage, EnumProperty};

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum StateError {
    #[strum(message = "The provided rating is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidRating,
    #[strum(message = "The provided location is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidLocation,
    #[strum(message = "The provided reading status is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidReadingStatus,
    #[strum(message = "The provided state is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidState,
}

pub const VALID_READING_STATUS: [&str; 3] = ["Unread", "Reading", "Read"];

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Merge)]
#[merge(strategy = merge::option::overwrite_none)]
pub struct Location {
    pub tag: Option<String>,
    pub source: Option<String>,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Merge)]
#[merge(strategy = merge::option::overwrite_none)]
pub struct Statistics {
    pub rating: Option<f32>,
    pub reading_status: Option<String>,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Merge)]
#[merge(strategy = merge::option::recurse)]
pub struct State {
    pub location: Option<Location>,
    pub statistics: Option<Statistics>,
}
