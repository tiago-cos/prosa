use super::models::{Annotation, AnnotationError, NewAnnotationRequest};
use crate::app::{
    SourceCache, TagCache, TagLengthCache, annotations::repository::AnnotationRepository,
    books::repository::BookRepository, error::ProsaError,
};
use epub::doc::EpubDoc;
use regex::Regex;
use std::{collections::HashSet, sync::Arc};
use uuid::Uuid;

pub struct AnnotationService {
    epub_path: String,
    source_cache: Arc<SourceCache>,
    tag_cache: Arc<TagCache>,
    tag_length_cache: Arc<TagLengthCache>,
    book_repository: Arc<BookRepository>,
    annotation_repository: Arc<AnnotationRepository>,
}

impl AnnotationService {
    pub fn new(
        epub_path: String,
        source_cache: Arc<SourceCache>,
        tag_cache: Arc<TagCache>,
        tag_length_cache: Arc<TagLengthCache>,
        book_repository: Arc<BookRepository>,
        annotation_repository: Arc<AnnotationRepository>,
    ) -> Self {
        Self {
            epub_path,
            source_cache,
            tag_cache,
            tag_length_cache,
            book_repository,
            annotation_repository,
        }
    }

    pub async fn add_annotation(
        &self,
        book_id: &str,
        annotation: NewAnnotationRequest,
    ) -> Result<String, ProsaError> {
        let epub_id = &self.book_repository.get_book(book_id).await?.epub_id;

        if !self.validate_annotation(&annotation, epub_id) {
            return Err(AnnotationError::InvalidAnnotation.into());
        }

        let annotation_id = Uuid::new_v4().to_string();
        self.annotation_repository
            .add_annotation(&annotation_id, book_id, &annotation)
            .await?;

        Ok(annotation_id)
    }

    pub async fn get_annotation(&self, annotation_id: &str) -> Result<Annotation, ProsaError> {
        let annotation = self.annotation_repository.get_annotation(annotation_id).await?;
        Ok(annotation)
    }

    pub async fn get_annotations(&self, book_id: &str) -> Vec<String> {
        self.annotation_repository.get_annotations(book_id).await
    }

    pub async fn delete_annotation(&self, annotation_id: &str) -> Result<(), ProsaError> {
        self.annotation_repository
            .delete_annotation(annotation_id)
            .await?;
        Ok(())
    }

    pub async fn patch_annotation(
        &self,
        annotation_id: &str,
        note: Option<String>,
    ) -> Result<(), ProsaError> {
        let note = note.filter(|n| !n.is_empty());
        self.annotation_repository
            .patch_annotation(annotation_id, note)
            .await?;
        Ok(())
    }

    fn validate_annotation(&self, annotation: &NewAnnotationRequest, epub_id: &str) -> bool {
        if !Self::validate_tags(&annotation.start_tag, &annotation.end_tag) {
            return false;
        }

        let source_cache_key = format!("sources:{epub_id}");
        let tag_cache_key = format!("tags:{}:{}", epub_id, &annotation.source);
        let start_tag_length_cache_key = format!(
            "tag_lengths:{}:{}:{}",
            epub_id, &annotation.source, annotation.start_tag
        );
        let end_tag_length_cache_key = format!(
            "tag_lengths:{}:{}:{}",
            epub_id, &annotation.source, annotation.end_tag
        );

        if let (Some(sources), Some(tags), Some(start_length), Some(end_length)) = (
            self.source_cache.get(&source_cache_key),
            self.tag_cache.get(&tag_cache_key),
            self.tag_length_cache.get(&start_tag_length_cache_key),
            self.tag_length_cache.get(&end_tag_length_cache_key),
        ) {
            return sources.contains(&annotation.source)
                && tags.contains(&annotation.start_tag)
                && tags.contains(&annotation.end_tag)
                && annotation.start_char < start_length
                && annotation.end_char < end_length;
        }

        let epub_file = format!("{}/{epub_id}.kepub.epub", self.epub_path);
        let Ok(mut doc) = EpubDoc::new(epub_file) else {
            return false;
        };

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

        if !sources.contains(&annotation.source) {
            return false;
        }

        let Some(text) = doc.get_resource_str_by_path(&annotation.source) else {
            return false;
        };

        let tags = self.tag_cache.get(&tag_cache_key).unwrap_or_else(|| {
            let tags = Self::extract_tags(&text);
            let tags = Arc::new(tags);
            self.tag_cache.insert(tag_cache_key.clone(), tags.clone());
            tags
        });

        if !tags.contains(&annotation.start_tag) || !tags.contains(&annotation.end_tag) {
            return false;
        }

        let start_length = self
            .tag_length_cache
            .get(&start_tag_length_cache_key)
            .unwrap_or_else(|| {
                let length = Self::get_tag_length(&annotation.start_tag, &text).unwrap_or_default();
                self.tag_length_cache
                    .insert(start_tag_length_cache_key.clone(), length);
                length
            });

        let end_length = self
            .tag_length_cache
            .get(&end_tag_length_cache_key)
            .unwrap_or_else(|| {
                let length = Self::get_tag_length(&annotation.end_tag, &text).unwrap_or_default();
                self.tag_length_cache
                    .insert(end_tag_length_cache_key.clone(), length);
                length
            });

        annotation.start_char < start_length && annotation.end_char < end_length
    }

    fn get_tag_length(tag_id: &str, text: &str) -> Option<u32> {
        let tag = format!("<span class=\"koboSpan\" id=\"{tag_id}\">");
        let start_pos = text.find(&tag)?;
        let content_start = start_pos + tag.len();
        let content_end = text[content_start..].find("</span>")? + content_start;
        Some(text[content_start..content_end].chars().count() as u32)
    }

    fn validate_tags(start: &str, end: &str) -> bool {
        let parse = |tag: &str| -> Option<(u32, u32)> {
            let raw = tag.strip_prefix("kobo.")?;
            let mut it = raw.split('.');
            let hi = it.next()?.parse().ok()?;
            let lo = it.next()?.parse().ok()?;
            if it.next().is_some() {
                return None;
            }
            Some((hi, lo))
        };

        parse(start).zip(parse(end)).is_some_and(|(s, e)| s <= e)
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
