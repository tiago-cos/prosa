use super::models::{State, StateError, Statistics, VALID_READING_STATUS};
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::{books, epubs, sync};
use crate::app::{error::ProsaError, state::repository};
use crate::database::pool;
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

pub async fn patch_state(book_id: &str, mut state: State, session_id: &str) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;

    if state.location.is_none() && state.statistics.is_none() {
        return Err(StateError::InvalidState.into());
    }

    let original = repository::get_state(pool(), book_id).await;
    state.merge(original);

    validate_state(&state, &book.epub_id).await?;
    repository::update_state(pool(), book_id, state).await;
    log_change(book_id, &book.owner_id, session_id).await;

    Ok(())
}

pub async fn update_state(book_id: &str, state: State, session_id: &str) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;

    validate_state(&state, &book.epub_id).await?;
    repository::update_state(pool(), book_id, state).await;
    log_change(book_id, &book.owner_id, session_id).await;

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

async fn log_change(book_id: &str, owner_id: &str, session_id: &str) {
    sync::service::log_change(
        book_id,
        ChangeLogEntityType::BookState,
        ChangeLogAction::Update,
        owner_id,
        session_id,
    )
    .await;
}
