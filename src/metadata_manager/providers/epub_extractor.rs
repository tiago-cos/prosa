use super::rate_limiter::RateLimiter;
use crate::{
    app::metadata::models::{Contributor, Metadata, Series},
    metadata_manager::fetcher::MetadataProvider,
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
    async fn fetch_metadata(&mut self, epub_data: &Vec<u8>) -> (Option<Metadata>, Option<Vec<u8>>) {
        self.rate_limiter.cooldown().await;

        let epub = Cursor::new(epub_data);
        let mut epub = EpubDoc::from_reader(epub).ok().expect("Failed to open epub");

        let title = epub.mdata("title");
        let subtitle = epub.mdata("subtitle");
        let description = epub.mdata("description");
        let publisher = epub.mdata("publisher");
        let isbn = epub.mdata("identifier");
        let series = epub.mdata("calibre:series");
        let page_count = None;
        let language = epub.mdata("language");

        let series_number = epub
            .mdata("calibre:series_index")
            .map(|num| num.parse().expect("Failed to parse series number"));

        let series = match (series, series_number) {
            (Some(series), Some(number)) => Some(Series {
                title: series,
                number,
            }),
            _ => None,
        };

        let contributors = match epub.mdata("creator") {
            Some(c) => Some(vec![Contributor {
                name: c,
                role: "Author".to_string(),
            }]),
            None => None,
        };

        let genres = epub.metadata.get("subject").map(|g| g.to_owned());

        let publication_date = epub
            .mdata("date")
            .map(|date| parse_date(&date).expect("Failed to parse date"));

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

    for format in datetime_formats.iter() {
        if let Ok(d) = NaiveDateTime::parse_from_str(date_str, format) {
            return Ok(DateTime::from_naive_utc_and_offset(d, Utc));
        }
    }

    for format in date_formats.iter() {
        if let Ok(d) = NaiveDate::parse_from_str(date_str, format) {
            if let Some(dt) = d.and_hms_opt(0, 0, 0) {
                return Ok(dt.and_utc());
            }
        }
    }

    return Err("Error parsing date".to_string());
}
