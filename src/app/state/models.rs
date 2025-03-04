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

pub const VALID_READING_STATUS: [&str; 3]= ["Unread", "Reading", "Read"];

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
    pub reading_status: Option<String>,
}

#[skip_serializing_none]
#[derive(Serialize, Deserialize)]
pub struct State {
    pub location: Option<Location>,
    pub statistics: Option<Statistics>,
}

impl Merge for State {
    fn merge(&mut self, other: Self) -> () {
        match (&mut self.location, other.location) {
            (Some(l1), Some(l2)) => l1.merge(l2),
            (None, l2) => self.location = l2,
            _ => ()
        };

        match (&mut self.statistics, other.statistics) {
            (Some(s1), Some(s2)) => s1.merge(s2),
            (None, s2) => self.statistics = s2,
            _ => ()
        };
    }
}
