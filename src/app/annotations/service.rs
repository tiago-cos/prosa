use super::{
    data,
    models::{Annotation, AnnotationError, NewAnnotationRequest},
};
use crate::app::{error::ProsaError, SourceCache, TagCache, TagLengthCache};
use epub::doc::EpubDoc;
use regex::Regex;
use sqlx::SqlitePool;
use std::{collections::HashSet, sync::Arc};
use uuid::Uuid;

pub async fn add_annotation(
    pool: &SqlitePool,
    book_id: &str,
    annotation: NewAnnotationRequest,
    epub_path: &str,
    epub_id: &str,
    source_cache: &SourceCache,
    tag_cache: &TagCache,
    tag_length_cache: &TagLengthCache,
) -> Result<String, AnnotationError> {
    if !validate_annotation(
        &annotation,
        epub_path,
        epub_id,
        source_cache,
        tag_cache,
        tag_length_cache,
    )
    .await
    {
        return Err(AnnotationError::InvalidAnnotation);
    }

    let annotation_id = Uuid::new_v4().to_string();
    data::add_annotation(pool, &annotation_id, book_id, annotation).await?;

    Ok(annotation_id)
}

pub async fn get_annotation(pool: &SqlitePool, annotation_id: &str) -> Result<Annotation, ProsaError> {
    let annotation = data::get_annotation(pool, annotation_id).await?;

    Ok(annotation)
}

pub async fn get_annotations(pool: &SqlitePool, book_id: &str) -> Vec<String> {
    let annotations = data::get_annotations(pool, book_id).await;

    annotations
}

pub async fn delete_annotation(pool: &SqlitePool, annotation_id: &str) -> Result<(), ProsaError> {
    data::delete_annotation(pool, annotation_id).await?;

    Ok(())
}

pub async fn patch_annotation(
    pool: &SqlitePool,
    annotation_id: &str,
    note: Option<String>,
) -> Result<(), ProsaError> {
    let note = note.filter(|n| !n.is_empty());
    data::patch_annotation(pool, annotation_id, note).await?;

    Ok(())
}

async fn validate_annotation(
    annotation: &NewAnnotationRequest,
    epub_path: &str,
    epub_id: &str,
    source_cache: &SourceCache,
    tag_cache: &TagCache,
    tag_length_cache: &TagLengthCache,
) -> bool {
    if !validate_tags(&annotation.start_tag, &annotation.end_tag).await {
        return false;
    }

    let source_cache_key = format!("sources:{}", epub_id);
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
        source_cache.get(&source_cache_key),
        tag_cache.get(&tag_cache_key),
        tag_length_cache.get(&start_tag_length_cache_key),
        tag_length_cache.get(&end_tag_length_cache_key),
    ) {
        return sources.contains(&annotation.source)
            && tags.contains(&annotation.start_tag)
            && tags.contains(&annotation.end_tag)
            && annotation.start_char < start_length
            && annotation.end_char < end_length;
    }

    let epub_file = format!("{}/{}.kepub.epub", epub_path, epub_id);
    let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");

    let sources = source_cache.get(&source_cache_key).unwrap_or_else(|| {
        let sources: HashSet<String> = doc
            .resources
            .iter()
            .filter_map(|r| r.1 .0.to_str().map(|s| s.to_string()))
            .collect();
        let sources = Arc::new(sources);
        source_cache.insert(source_cache_key, sources.clone());
        sources
    });

    if !sources.contains(&annotation.source) {
        return false;
    }

    let text = doc
        .get_resource_str_by_path(&annotation.source)
        .expect("Failed to get book resource");

    let tags = tag_cache.get(&tag_cache_key).unwrap_or_else(|| {
        let tags = extract_tags(&text);
        let tags = Arc::new(tags);
        tag_cache.insert(tag_cache_key, tags.clone());
        tags
    });

    if !tags.contains(&annotation.start_tag) || !tags.contains(&annotation.end_tag) {
        return false;
    }

    let start_length = tag_length_cache
        .get(&start_tag_length_cache_key)
        .unwrap_or_else(|| {
            let length = get_tag_length(&annotation.start_tag, &text).expect("Failed to get tag length");
            tag_length_cache.insert(start_tag_length_cache_key, length);
            length
        });

    let end_length = tag_length_cache
        .get(&end_tag_length_cache_key)
        .unwrap_or_else(|| {
            let length = get_tag_length(&annotation.end_tag, &text).expect("Failed to get tag length");
            tag_length_cache.insert(end_tag_length_cache_key, length);
            length
        });

    annotation.start_char < start_length && annotation.end_char < end_length
}

fn get_tag_length(tag_id: &str, text: &str) -> Option<u32> {
    let tag = format!("<span class=\"koboSpan\" id=\"{}\">", tag_id);
    let start_pos = text.find(&tag)?;
    let content_start = start_pos + tag.len();
    let content_end = text[content_start..].find("</span>")? + content_start;
    Some(text[content_start..content_end].chars().count() as u32)
}

async fn validate_tags(start: &str, end: &str) -> bool {
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

    parse(start).zip(parse(end)).map_or(false, |(s, e)| s <= e)
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
