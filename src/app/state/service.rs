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

pub struct StateService {
    pool: SqlitePool,
    epub_path: String,
    source_cache: Arc<SourceCache>,
    tag_cache: Arc<TagCache>,
}

impl StateService {
    pub fn new(
        pool: SqlitePool,
        epub_path: String,
        source_cache: Arc<SourceCache>,
        tag_cache: Arc<TagCache>,
    ) -> Self {
        Self {
            pool,
            epub_path,
            source_cache,
            tag_cache,
        }
    }

    pub async fn initialize_state(&self) -> String {
        let initial_state = State {
            location: None,
            statistics: Some(Statistics {
                rating: None,
                reading_status: Some(VALID_READING_STATUS[0].to_string()),
            }),
        };
        let state_id = Uuid::new_v4().to_string();

        data::add_state(&self.pool, &state_id, initial_state).await;
        state_id
    }

    pub async fn get_state(&self, state_id: &str) -> State {
        data::get_state(&self.pool, state_id).await
    }

    pub async fn patch_state(
        &self,
        state_id: &str,
        epub_id: &str,
        mut state: State,
    ) -> Result<(), ProsaError> {
        if state.location.is_none() && state.statistics.is_none() {
            return Err(StateError::InvalidState.into());
        }

        let original = data::get_state(&self.pool, state_id).await;
        state.merge(original);

        self.validate_state(&state, epub_id)?;
        data::update_state(&self.pool, state_id, state).await;

        Ok(())
    }

    pub async fn update_state(&self, state_id: &str, epub_id: &str, state: State) -> Result<(), ProsaError> {
        self.validate_state(&state, epub_id)?;
        data::update_state(&self.pool, state_id, state).await;

        Ok(())
    }

    fn validate_state(&self, state: &State, epub_id: &str) -> Result<(), ProsaError> {
        match &state.statistics {
            Some(s) => Self::validate_statistics(s)?,
            None => return Err(StateError::InvalidState.into()),
        }

        if let Some(l) = &state.location {
            self.validate_location(l, epub_id)?;
        }

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

    fn validate_location(&self, location: &Location, epub_id: &str) -> Result<(), ProsaError> {
        let (Some(source), Some(tag)) = (&location.source, &location.tag) else {
            return Err(StateError::InvalidLocation.into());
        };

        let source_cache_key = format!("sources:{epub_id}");
        let tag_cache_key = format!("tags:{epub_id}:{source}");

        if let (Some(sources), Some(tags)) = (
            self.source_cache.get(&source_cache_key),
            self.tag_cache.get(&tag_cache_key),
        ) && sources.contains(source)
            && tags.contains(tag)
        {
            return Ok(());
        }

        let epub_file = format!("{}/{epub_id}.kepub.epub", self.epub_path);
        let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");

        let sources = self.source_cache.get(&source_cache_key).unwrap_or_else(|| {
            let sources: HashSet<String> = doc
                .resources
                .iter()
                .filter_map(|r| r.1.0.to_str().map(ToString::to_string))
                .collect();
            let sources = Arc::new(sources);
            self.source_cache
                .insert(source_cache_key.clone(), sources.clone());
            sources
        });

        if !sources.contains(source) {
            return Err(StateError::InvalidLocation.into());
        }

        let tags = self.tag_cache.get(&tag_cache_key).unwrap_or_else(|| {
            let text = doc
                .get_resource_str_by_path(source)
                .expect("Failed to get book resource");

            let tags = Arc::new(Self::extract_tags(&text));
            self.tag_cache.insert(tag_cache_key.clone(), tags.clone());
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
}
