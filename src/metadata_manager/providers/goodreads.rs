use super::rate_limiter::RateLimiter;
use crate::{
    app::metadata::models::{Contributor, Metadata, Series},
    metadata_manager::fetcher::MetadataProvider,
};
use async_trait::async_trait;
use epub::doc::EpubDoc;
use grscraper::MetadataRequestBuilder;
use std::io::Cursor;

type GoodreadsMetadata = grscraper::BookMetadata;
type GoodreadsSeries = grscraper::BookSeries;
type GoodreadsContributor = grscraper::BookContributor;

pub struct GoodreadsMetadataScraper {
    rate_limiter: RateLimiter,
}

impl GoodreadsMetadataScraper {
    pub fn new(cooldown: u64) -> Self {
        Self {
            rate_limiter: RateLimiter::new(cooldown),
        }
    }
}

#[async_trait]
impl MetadataProvider for GoodreadsMetadataScraper {
    async fn fetch_metadata(&mut self, epub_data: &[u8]) -> (Option<Metadata>, Option<Vec<u8>>) {
        self.rate_limiter.cooldown().await;

        let epub = Cursor::new(epub_data);
        let epub = EpubDoc::from_reader(epub).unwrap();

        let Some(title) = epub.mdata("title") else {
            return (None, None);
        };
        let author = epub.mdata("creator");

        let builder = MetadataRequestBuilder::default().with_title(&title);
        let metadata = match author {
            Some(author) => builder.with_author(&author).execute().await,
            None => builder.execute().await,
        };

        let Ok(Some(metadata)) = metadata else {
            return (None, None);
        };

        let Some(image_url) = &metadata.image_url else {
            return (Some(metadata.into()), None);
        };

        let image = ureq::get(image_url)
            .call()
            .expect("Failed to get image data")
            .into_body()
            .read_to_vec()
            .expect("Failed to get image bytes");

        (Some(metadata.into()), Some(image))
    }
}

impl From<GoodreadsMetadata> for Metadata {
    fn from(metadata: GoodreadsMetadata) -> Self {
        let contributors = Some(metadata.contributors)
            .filter(|c| !c.is_empty())
            .map(|c| c.into_iter().map(Contributor::from).collect());

        let genres = Some(metadata.genres).filter(|g| !g.is_empty());
        let series = metadata.series.map(Series::from);

        Metadata {
            title: Some(metadata.title),
            subtitle: metadata.subtitle,
            description: metadata.description,
            publisher: metadata.publisher,
            publication_date: metadata.publication_date,
            isbn: metadata.isbn,
            contributors,
            genres,
            series,
            page_count: metadata.page_count,
            language: metadata.language,
        }
    }
}

impl From<GoodreadsContributor> for Contributor {
    fn from(contributor: GoodreadsContributor) -> Self {
        Contributor {
            name: contributor.name,
            role: contributor.role,
        }
    }
}

impl From<GoodreadsSeries> for Series {
    fn from(series: GoodreadsSeries) -> Self {
        Series {
            title: series.title,
            number: series.number,
        }
    }
}
