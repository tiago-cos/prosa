use super::{
    data,
    models::{Location, State, StateError, Statistics, VALID_READING_STATUS},
};
use crate::app::{SourceCache, TagCache, error::ProsaError};
use epub::doc::EpubDoc;
use merge::Merge;
use regex::Regex;
use sqlx::SqlitePool;
use std::{collections::HashSet, sync::Arc};
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
    source_cache: &SourceCache,
    tag_cache: &TagCache,
    mut state: State,
) -> Result<(), ProsaError> {
    if state.location.is_none() && state.statistics.is_none() {
        return Err(StateError::InvalidState.into());
    }

    let original = data::get_state(pool, state_id).await;
    state.merge(original);

    validate_state(&state, epub_path, epub_id, source_cache, tag_cache).await?;
    data::update_state(pool, state_id, state).await;

    Ok(())
}

pub async fn update_state(
    pool: &SqlitePool,
    state_id: &str,
    epub_path: &str,
    epub_id: &str,
    source_cache: &SourceCache,
    tag_cache: &TagCache,
    state: State,
) -> Result<(), ProsaError> {
    validate_state(&state, epub_path, epub_id, source_cache, tag_cache).await?;
    data::update_state(pool, state_id, state).await;

    Ok(())
}

pub async fn validate_state(
    state: &State,
    epub_path: &str,
    epub_id: &str,
    source_cache: &SourceCache,
    tag_cache: &TagCache,
) -> Result<(), ProsaError> {
    match &state.statistics {
        Some(s) => validate_statistics(s).await?,
        None => return Err(StateError::InvalidState.into()),
    };

    match &state.location {
        Some(l) => validate_location(l, epub_path, epub_id, source_cache, tag_cache).await?,
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
            return Err(StateError::InvalidReadingStatus.into());
        }
        _ => (),
    }

    Ok(())
}

async fn validate_location(
    location: &Location,
    epub_path: &str,
    epub_id: &str,
    source_cache: &SourceCache,
    tag_cache: &TagCache,
) -> Result<(), ProsaError> {
    let (source, tag) = match (&location.source, &location.tag) {
        (Some(s), Some(t)) => (s, t),
        _ => return Err(StateError::InvalidLocation.into()),
    };

    let source_cache_key = format!("sources:{}", epub_id);
    let tag_cache_key = format!("tags:{}:{}", epub_id, source);

    if let (Some(sources), Some(tags)) = (source_cache.get(&source_cache_key), tag_cache.get(&tag_cache_key))
    {
        if sources.contains(source) && tags.contains(tag) {
            return Ok(());
        }
    }

    let epub_file = format!("{}/{}.kepub.epub", epub_path, epub_id);
    let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");

    let sources = source_cache.get(&source_cache_key).unwrap_or_else(|| {
        let sources: HashSet<String> = doc
            .resources
            .iter()
            .filter_map(|r| r.1.0.to_str().map(|s| s.to_string()))
            .collect();
        let sources = Arc::new(sources);
        source_cache.insert(source_cache_key, sources.clone());
        sources
    });

    if !sources.contains(source) {
        return Err(StateError::InvalidLocation.into());
    }

    let tags = tag_cache.get(&tag_cache_key).unwrap_or_else(|| {
        let text = doc
            .get_resource_str_by_path(source)
            .expect("Failed to get book resource");

        let tags = Arc::new(extract_tags(&text));
        tag_cache.insert(tag_cache_key, tags.clone());
        tags
    });

    if !tags.contains(tag) {
        return Err(StateError::InvalidLocation.into());
    }

    Ok(())
}

fn extract_tags(text: &str) -> HashSet<String> {
    let tag_pattern = r#"<span class="koboSpan" id="([^"]+)""#;
    let re = Regex::new(tag_pattern).unwrap();

    re.captures_iter(text)
        .filter_map(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
        .filter(|tag| tag.starts_with("kobo."))
        .collect()
}
