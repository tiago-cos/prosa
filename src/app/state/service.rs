use super::{
    data,
    models::{Location, State, StateError, Statistics, VALID_READING_STATUS},
};
use crate::app::error::ProsaError;
use epub::doc::EpubDoc;
use merge::Merge;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn initialize_state(pool: &SqlitePool) -> String {
    let initial_state = State {
        location: None,
        statistics: Some(Statistics {
            rating: None,
            reading_status: Some(VALID_READING_STATUS[0].to_string()),
        }),
    };
    let state_id = Uuid::new_v4().to_string();

    data::add_state(pool, &state_id, initial_state).await;

    state_id
}

pub async fn get_state(pool: &SqlitePool, state_id: &str) -> State {
    let state = data::get_state(pool, state_id).await;

    state
}

pub async fn patch_state(
    pool: &SqlitePool,
    state_id: &str,
    epub_path: &str,
    epub_id: &str,
    mut state: State,
) -> Result<(), ProsaError> {
    let original = data::get_state(pool, state_id).await;
    state.merge(original);

    validate_state(&state, epub_path, epub_id).await?;
    data::update_state(pool, state_id, state).await;

    Ok(())
}

pub async fn update_state(
    pool: &SqlitePool,
    state_id: &str,
    epub_path: &str,
    epub_id: &str,
    state: State,
) -> Result<(), ProsaError> {
    validate_state(&state, epub_path, epub_id).await?;
    data::update_state(pool, state_id, state).await;

    Ok(())
}

pub async fn validate_state(state: &State, epub_path: &str, epub_id: &str) -> Result<(), ProsaError> {
    match &state.statistics {
        Some(s) => validate_statistics(s).await?,
        None => return Err(StateError::InvalidState.into()),
    };

    match &state.location {
        Some(l) => validate_location(l, epub_path, epub_id).await?,
        _ => (),
    };

    Ok(())
}

async fn validate_statistics(stats: &Statistics) -> Result<(), ProsaError> {
    match stats.rating {
        Some(rating) if rating < 0.0 || rating > 5.0 => return Err(StateError::InvalidRating.into()),
        _ => (),
    };

    match stats.reading_status.as_deref() {
        None => return Err(StateError::InvalidReadingStatus.into()),
        Some(status) if !VALID_READING_STATUS.contains(&status) => {
            return Err(StateError::InvalidReadingStatus.into())
        }
        _ => (),
    }

    Ok(())
}

async fn validate_location(location: &Location, epub_path: &str, epub_id: &str) -> Result<(), ProsaError> {
    let epub_file = format!("{}/{}.kepub.epub", epub_path, epub_id);
    let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");
    let sources: Vec<String> = doc
        .resources
        .iter()
        .filter_map(|r| r.1 .0.to_str().map(|s| s.to_string()))
        .collect();

    let source = match &location.source {
        None => return Err(StateError::InvalidLocation.into()),
        Some(s) => s,
    };

    if !sources.contains(&source) {
        return Err(StateError::InvalidLocation.into());
    }

    let tag = match &location.tag {
        None => return Ok(()),
        Some(t) => t,
    };

    let text = doc
        .get_resource_str_by_path(source)
        .expect("Failed to get book resource");
    let tag = format!("<span class=\"koboSpan\" id=\"{}\">", tag);

    if !text.contains(&tag) {
        return Err(StateError::InvalidLocation.into());
    }

    Ok(())
}
