use crate::app::metadata::models::{Contributor, Metadata, Series};
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use epub::doc::{EpubDoc, MetadataItem};
use log::warn;
use std::io::Cursor;

const BOOK_PRODUCER: &str = "bkp";

pub fn extract(epub_data: &[u8]) -> (Option<Metadata>, Option<Vec<u8>>) {
    let Ok(mut epub) = EpubDoc::from_reader(Cursor::new(epub_data)) else {
        warn!("Skipping metadata extraction: the book could not be opened as an EPUB");
        return (None, None);
    };

    let (title, subtitle) = titles(&epub.metadata);

    let metadata = Metadata {
        title,
        subtitle,
        description: first(&epub.metadata, "description").map(|item| item.value.clone()),
        publisher: first(&epub.metadata, "publisher").map(|item| item.value.clone()),
        publication_date: first(&epub.metadata, "date").and_then(|item| parse_date(&item.value).ok()),
        isbn: isbn(&epub.metadata),
        contributors: contributors(&epub.metadata),
        genres: genres(&epub.metadata),
        series: series(&epub.metadata),
        page_count: None,
        language: language(&epub.metadata),
    };

    let cover = epub.get_cover().map(|(data, _)| data);

    ((!metadata.is_empty()).then_some(metadata), cover)
}

fn first<'a>(metadata: &'a [MetadataItem], property: &str) -> Option<&'a MetadataItem> {
    metadata.iter().find(|item| item.property == property)
}

fn titles(metadata: &[MetadataItem]) -> (Option<String>, Option<String>) {
    let titles: Vec<&MetadataItem> = metadata.iter().filter(|item| item.property == "title").collect();

    let title = titles
        .iter()
        .find(|item| {
            item.refinement("title-type")
                .is_none_or(|kind| kind.value.eq_ignore_ascii_case("main"))
        })
        .or_else(|| titles.first())
        .map(|item| item.value.clone());

    let subtitle = titles
        .iter()
        .find(|item| {
            item.refinement("title-type")
                .is_some_and(|kind| kind.value.eq_ignore_ascii_case("subtitle"))
        })
        .map(|item| item.value.clone())
        .or_else(|| first(metadata, "subtitle").map(|item| item.value.clone()));

    (title, subtitle)
}

fn isbn(metadata: &[MetadataItem]) -> Option<String> {
    metadata
        .iter()
        .filter(|item| item.property == "identifier")
        .find_map(|item| {
            let declared = item
                .refinement("scheme")
                .is_some_and(|scheme| scheme.value.eq_ignore_ascii_case("isbn"))
                || item
                    .refinement("identifier-type")
                    .is_some_and(|kind| matches!(kind.value.trim(), "02" | "15"));

            let value = item.value.trim();
            let value = value
                .strip_prefix("urn:isbn:")
                .or_else(|| value.strip_prefix("URN:ISBN:"))
                .unwrap_or(value);
            let digits: String = value.chars().filter(|c| *c != '-' && *c != ' ').collect();

            (declared || is_isbn(&digits))
                .then_some(digits)
                .filter(|d| is_isbn(d))
        })
}

fn is_isbn(value: &str) -> bool {
    let bytes = value.as_bytes();

    match bytes.len() {
        10 => {
            bytes[..9].iter().all(u8::is_ascii_digit)
                && (bytes[9].is_ascii_digit() || bytes[9].eq_ignore_ascii_case(&b'X'))
        }
        13 => bytes.iter().all(u8::is_ascii_digit),
        _ => false,
    }
}

fn contributors(metadata: &[MetadataItem]) -> Option<Vec<Contributor>> {
    let contributors: Vec<Contributor> = metadata
        .iter()
        .filter(|item| item.property == "creator" || item.property == "contributor")
        .filter(|item| {
            item.refinement("role")
                .is_none_or(|role| !role.value.trim().eq_ignore_ascii_case(BOOK_PRODUCER))
        })
        .map(|item| Contributor {
            name: item.value.clone(),
            role: item.refinement("role").map_or_else(
                || default_role(&item.property).to_string(),
                |role| role_label(role.value.trim()),
            ),
        })
        .collect();

    (!contributors.is_empty()).then_some(contributors)
}

const fn default_role(property: &str) -> &str {
    match property.as_bytes() {
        b"creator" => "Author",
        _ => "Contributor",
    }
}

fn role_label(code: &str) -> String {
    match code {
        "aut" => "Author".to_string(),
        "edt" => "Editor".to_string(),
        "trl" => "Translator".to_string(),
        "ill" => "Illustrator".to_string(),
        "nrt" => "Narrator".to_string(),
        "pbl" => "Publisher".to_string(),
        "ctb" => "Contributor".to_string(),
        other => other.to_string(),
    }
}

fn genres(metadata: &[MetadataItem]) -> Option<Vec<String>> {
    let genres: Vec<String> = metadata
        .iter()
        .filter(|item| item.property == "subject")
        .map(|item| item.value.clone())
        .collect();

    (!genres.is_empty()).then_some(genres)
}

fn language(metadata: &[MetadataItem]) -> Option<String> {
    let value = first(metadata, "language")?.value.trim();

    let primary = value.split(['-', '_']).next().unwrap_or(value);

    let name = match primary.to_ascii_lowercase().as_str() {
        "ar" => "Arabic",
        "cs" => "Czech",
        "da" => "Danish",
        "de" => "German",
        "el" => "Greek",
        "en" => "English",
        "es" => "Spanish",
        "fi" => "Finnish",
        "fr" => "French",
        "he" => "Hebrew",
        "hi" => "Hindi",
        "hu" => "Hungarian",
        "it" => "Italian",
        "ja" => "Japanese",
        "ko" => "Korean",
        "nl" => "Dutch",
        "no" | "nb" | "nn" => "Norwegian",
        "pl" => "Polish",
        "pt" => "Portuguese",
        "ro" => "Romanian",
        "ru" => "Russian",
        "sv" => "Swedish",
        "tr" => "Turkish",
        "uk" => "Ukrainian",
        "zh" => "Chinese",
        _ => return Some(value.to_string()),
    };

    Some(name.to_string())
}

fn series(metadata: &[MetadataItem]) -> Option<Series> {
    let title = first(metadata, "calibre:series").map(|item| item.value.clone())?;
    let number = first(metadata, "calibre:series_index").and_then(|item| item.value.trim().parse().ok());

    Some(Series { title, number })
}

fn parse_date(date_str: &str) -> Result<DateTime<Utc>, String> {
    let datetime_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
    ];

    let date_formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%B %d, %Y",
        "%d %B %Y",
        "%Y%m%d",
    ];

    if let Ok(d) = DateTime::parse_from_rfc3339(date_str) {
        return Ok(d.with_timezone(&Utc));
    }

    for format in &datetime_formats {
        if let Ok(d) = NaiveDateTime::parse_from_str(date_str, format) {
            return Ok(DateTime::from_naive_utc_and_offset(d, Utc));
        }
    }

    for format in &date_formats {
        if let Ok(d) = NaiveDate::parse_from_str(date_str, format)
            && let Some(dt) = d.and_hms_opt(0, 0, 0)
        {
            return Ok(dt.and_utc());
        }
    }

    Err("Error parsing date".to_string())
}
