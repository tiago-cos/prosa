use super::{
    data,
    models::{Location, State, StateError, Statistics},
};
use epub::doc::EpubDoc;
use merge::Merge;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn initialize_state(pool: &SqlitePool) -> String {
    let initial_state = State { location: None, statistics: None };
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
    mut state: State
) -> Result<(), StateError> {
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
    state: State
) -> Result<(), StateError> {
    validate_state(&state, epub_path, epub_id).await?;
    data::update_state(pool, state_id, state).await;

    Ok(())
}

pub async fn validate_state(state: &State, epub_path: &str, epub_id: &str) -> Result<(), StateError> {
    match &state.statistics {
        Some(s) if !validate_statistics(s).await => return Err(StateError::InvalidRating),
        _ => (),
    };

    match &state.location {
        Some(l) if !validate_location(l, epub_path, epub_id).await => return Err(StateError::InvalidLocation),
        _ => (),
    };

    Ok(())
}

async fn validate_statistics(stats: &Statistics) -> bool {
    return stats.rating >= Some(0.0) && stats.rating <= Some(5.0)
}

async fn validate_location(location: &Location, epub_path: &str, epub_id: &str) -> bool {
    let epub_file = format!("{}/{}.kepub.epub", epub_path, epub_id);
    let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");
    let sources: Vec<String> = doc
        .resources
        .iter()
        .filter_map(|r| r.1 .0.to_str().map(|s| s.to_string()))
        .collect();

    let (source, tag) = match (&location.source, &location.tag) {
        (_, None) => return false,
        (None, _) => return false,
        (Some(source), Some(tag)) => (source, tag),
    };

    if !sources.contains(&source) {
        return false;
    }

    let text = doc
        .get_resource_str_by_path(source)
        .expect("Failed to get book resource");
    let tag = format!("<span class=\"koboSpan\" id=\"{}\"", tag);

    return text.contains(&tag);
}