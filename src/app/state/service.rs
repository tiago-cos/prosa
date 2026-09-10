use super::models::{State, StateError, Statistics, VALID_READING_STATUS};
use crate::app::epubs;
use crate::database::pool;
use crate::app::{error::ProsaError, state::repository};
use kepub_rs::validate_epub_location;
use merge::Merge;
use sqlx::SqliteConnection;
use std::fs::File;

pub async fn initialize_state(conn: &mut SqliteConnection, book_id: &str) {
    let initial_state = State {
        location: None,
        statistics: Some(Statistics {
            rating: None,
            reading_status: Some(VALID_READING_STATUS[0].to_string()),
        }),
    };
    repository::add_state(conn, book_id, initial_state).await;
}

pub async fn get_state(book_id: &str) -> State {
    repository::get_state(pool(), book_id).await
}

pub async fn patch_state(book_id: &str, epub_id: &str, mut state: State) -> Result<(), ProsaError> {
    if state.location.is_none() && state.statistics.is_none() {
        return Err(StateError::InvalidState.into());
    }

    let original = repository::get_state(pool(), book_id).await;
    state.merge(original);

    validate_state(&state, epub_id).await?;
    repository::update_state(pool(), book_id, state).await;

    Ok(())
}

pub async fn update_state(book_id: &str, epub_id: &str, state: State) -> Result<(), ProsaError> {
    validate_state(&state, epub_id).await?;
    repository::update_state(pool(), book_id, state).await;

    Ok(())
}

fn validate_statistics(stats: &Statistics) -> Result<(), ProsaError> {
    if let Some(rating) = stats.rating
        && !(0.0..=5.0).contains(&rating)
    {
        return Err(StateError::InvalidRating.into());
    }

    match stats.reading_status.as_deref() {
        None => return Err(StateError::InvalidReadingStatus.into()),
        Some(status) if !VALID_READING_STATUS.contains(&status) => {
            return Err(StateError::InvalidReadingStatus.into());
        }
        _ => (),
    }

    Ok(())
}

async fn validate_state(state: &State, epub_id: &str) -> Result<(), ProsaError> {
    match &state.statistics {
        Some(s) => validate_statistics(s)?,
        None => return Err(StateError::InvalidState.into()),
    }

    let Some(location) = state.location.clone() else {
        return Ok(());
    };

    let epub_file = epubs::service::epub_path(epub_id);

    let valid = tokio::task::spawn_blocking(move || {
        File::open(&epub_file).is_ok_and(|file| validate_epub_location(file, &location).is_ok())
    })
    .await
    .expect("Location validation task failed");

    if !valid {
        return Err(StateError::InvalidLocation.into());
    }

    Ok(())
}
