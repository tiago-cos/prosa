use super::rate_limiter::RateLimiter;
use crate::app::{
    core::metadata_fetcher::fetcher::MetadataProvider,
    metadata::models::{Contributor, Metadata, Series},
};
use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use epub::doc::EpubDoc;
use std::io::Cursor;

pub struct EpubExtractor {
    rate_limiter: RateLimiter,
}

impl EpubExtractor {
    pub fn new(cooldown: u64) -> Self {
        Self {
            rate_limiter: RateLimiter::new(cooldown),
        }
    }
}

#[async_trait]
impl MetadataProvider for EpubExtractor {
    async fn fetch_metadata(&mut self, epub_data: &[u8]) -> (Option<Metadata>, Option<Vec<u8>>) {
        self.rate_limiter.cooldown().await;

        let epub = Cursor::new(epub_data);
        let mut epub = EpubDoc::from_reader(epub).expect("Failed to open epub");

        let title = epub.mdata("title").map(|m| m.value.clone());
        let subtitle = epub.mdata("subtitle").map(|m| m.value.clone());
        let description = epub.mdata("description").map(|m| m.value.clone());
        let publisher = epub.mdata("publisher").map(|m| m.value.clone());
        let isbn = epub.mdata("identifier").map(|m| m.value.clone());
        let series = epub.mdata("calibre:series").map(|m| m.value.clone());
        let page_count = None;
        let language = epub.mdata("language").map(|m| m.value.clone());

        let series_number = epub
            .mdata("calibre:series_index")
            .map(|num| num.value.parse().expect("Failed to parse series number"));

        let series = match (series, series_number) {
            (Some(series), Some(number)) => Some(Series {
                title: series,
                number,
            }),
            _ => None,
        };

        let contributors = match epub.mdata("creator") {
            Some(c) => Some(vec![Contributor {
                name: c.value.clone(),
                role: "Author".to_string(),
            }]),
            None => None,
        };

        let genres: Vec<String> = epub
            .metadata
            .iter()
            .filter(|m| m.property == "subject")
            .map(|m| m.value.clone())
            .collect();

        let genres = (!genres.is_empty()).then_some(genres);

        let publication_date = epub
            .mdata("date")
            .map(|date| parse_date(&date.value).expect("Failed to parse date"));

        let metadata = Metadata {
            title,
            subtitle,
            description,
            publisher,
            publication_date,
            isbn,
            contributors,
            genres,
            series,
            page_count,
            language,
        };

        if metadata.is_empty() {
            return (None, None);
        }

        let cover_image = epub.get_cover().map(|c| c.0);

        (Some(metadata), cover_image)
    }
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
