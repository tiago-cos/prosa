use super::{
    data,
    models::{Annotation, AnnotationError, NewAnnotationRequest},
};
use crate::app::error::ProsaError;
use epub::doc::EpubDoc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn add_annotation(
    pool: &SqlitePool,
    book_id: &str,
    annotation: NewAnnotationRequest,
    epub_path: &str,
    epub_id: &str,
) -> Result<String, AnnotationError> {
    if !validate_annotation(&annotation, epub_path, epub_id).await {
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

async fn validate_annotation(annotation: &NewAnnotationRequest, epub_path: &str, epub_id: &str) -> bool {
    let epub_file = format!("{}/{}.kepub.epub", epub_path, epub_id);
    let mut doc = EpubDoc::new(epub_file).expect("Error opening epub");
    let sources: Vec<String> = doc
        .resources
        .iter()
        .filter_map(|r| r.1 .0.to_str().map(|s| s.to_string()))
        .collect();

    if !sources.contains(&annotation.source) {
        return false;
    }

    let text = doc
        .get_resource_str_by_path(&annotation.source)
        .expect("Failed to get book resource");

    let start_tag = format!("<span class=\"koboSpan\" id=\"{}\">", annotation.start_tag);
    let end_tag = format!("<span class=\"koboSpan\" id=\"{}\">", annotation.end_tag);

    let (start_location, end_location) = match (text.find(&start_tag), text.find(&end_tag)) {
        (Some(start), Some(end)) => (start, end),
        _ => return false,
    };

    if !validate_tags(&annotation.start_tag, &annotation.end_tag).await {
        return false;
    }

    let (start_length, end_length) = match (
        get_tag_length(start_location, &start_tag, &text).await,
        get_tag_length(end_location, &end_tag, &text).await,
    ) {
        (Some(sl), Some(el)) => (sl, el),
        _ => return false,
    };

    let start_length: u32 = start_length.try_into().expect("Failed to convert length");
    let end_length: u32 = end_length.try_into().expect("Failed to convert length");

    annotation.start_char < start_length && annotation.end_char < end_length
}

async fn get_tag_length(position: usize, tag: &str, text: &str) -> Option<usize> {
    let start = position + tag.len();
    let end = text[start..].find("</span>")? + start;
    Some(text[start..end].chars().count())
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
