use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use strum_macros::{EnumMessage, EnumProperty};

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum StateError {
    #[strum(message = "Invalid rating value")]
    #[strum(props(StatusCode = "400"))]
    InvalidRating,
    #[strum(message = "Invalid location value")]
    #[strum(props(StatusCode = "400"))]
    InvalidLocation,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Merge)]
pub struct Location {
    pub tag: Option<String>,
    pub source: Option<String>,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize, Merge)]
pub struct Statistics {
    pub rating: Option<f32>,
}

#[derive(Serialize, Deserialize, Merge)]
pub struct State {
    pub location: Location,
    pub statistics: Statistics,
}
