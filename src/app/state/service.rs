use super::{
    data,
    models::{Location, State, StateError, Statistics},
};
use epub::doc::EpubDoc;
use merge::Merge;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn initialize_state(pool: &SqlitePool) -> String {
    let location = Location {
        tag: None,
        source: None,
    };

    let statistics = Statistics { rating: None };

    let initial_state = State { location, statistics };

    let state_id = Uuid::new_v4().to_string();

    data::add_state(pool, &state_id, initial_state).await;

    state_id
}

pub async fn get_state(pool: &SqlitePool, state_id: &str) -> State {
    let state = data::get_state(pool, state_id).await;

    state
}

pub async fn patch_state(pool: &SqlitePool, state_id: &str, mut state: State) -> () {
    let original = data::get_state(pool, state_id).await;
    state.merge(original);
    data::update_state(pool, state_id, state).await;
}

pub async fn update_state(pool: &SqlitePool, state_id: &str, state: State) -> () {
    data::update_state(pool, state_id, state).await;
}

pub async fn validate_state(state: &State, epub_path: &str, epub_id: &str) -> Result<(), StateError> {
    if state.statistics.rating < Some(0.0) || state.statistics.rating > Some(5.0) {
        return Err(StateError::InvalidRating);
    }

    let epub_file = format!("{}/{}.epub", epub_path, epub_id);
    let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");
    let sources: Vec<String> = doc
        .resources
        .iter()
        .filter_map(|r| r.1 .0.to_str().map(|s| s.to_string()))
        .collect();

    let (source, tag) = match (&state.location.source, &state.location.tag) {
        (Some(_), None) => return Err(StateError::InvalidLocation),
        (None, Some(_)) => return Err(StateError::InvalidLocation),
        (None, None) => return Ok(()),
        (Some(source), Some(tag)) => (source, tag),
    };

    if !sources.contains(&source) {
        return Err(StateError::InvalidLocation);
    }

    let text = doc
        .get_resource_str_by_path(source)
        .expect("Failed to get book resource");
    let tag = format!("<span class=\"koboSpan\" id=\"{}\"", tag);

    if !text.contains(&tag) {
        return Err(StateError::InvalidLocation);
    }

    Ok(())
}
