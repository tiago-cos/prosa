use super::rate_limiter::RateLimiter;
use crate::{
    CONFIG,
    app::metadata::models::{Contributor, Metadata, Series},
};
use book_metadata::{
    BookMetadata, MetadataProvider, MetadataQuery,
    providers::{
        googlebooks::GoogleBooksProvider, hardcover::HardcoverProvider, openlibrary::OpenLibraryProvider,
    },
};
use log::warn;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct RemoteProvider {
    provider_id: &'static str,
    build: fn(Option<&str>) -> Option<Arc<dyn MetadataProvider>>,
    rate_limiter: Mutex<RateLimiter>,
}

impl RemoteProvider {
    pub fn all() -> Vec<Self> {
        vec![
            Self {
                provider_id: "openlibrary",
                build: |_| {
                    OpenLibraryProvider::new()
                        .inspect_err(|e| warn!("Open Library is unavailable: {e}"))
                        .ok()
                        .map(|p| Arc::new(p) as Arc<dyn MetadataProvider>)
                },
                rate_limiter: Mutex::new(RateLimiter::new(CONFIG.metadata_cooldown.openlibrary)),
            },
            Self {
                provider_id: "hardcover",
                build: |key| {
                    HardcoverProvider::new(key?)
                        .inspect_err(|e| warn!("Hardcover is unavailable: {e}"))
                        .ok()
                        .map(|p| Arc::new(p) as Arc<dyn MetadataProvider>)
                },
                rate_limiter: Mutex::new(RateLimiter::new(CONFIG.metadata_cooldown.hardcover)),
            },
            Self {
                provider_id: "google_books",
                build: |key| {
                    GoogleBooksProvider::new(key?)
                        .inspect_err(|e| warn!("Google Books is unavailable: {e}"))
                        .ok()
                        .map(|p| Arc::new(p) as Arc<dyn MetadataProvider>)
                },
                rate_limiter: Mutex::new(RateLimiter::new(CONFIG.metadata_cooldown.google_books)),
            },
        ]
    }

    pub const fn provider_id(&self) -> &'static str {
        self.provider_id
    }

    pub async fn search(&self, queries: &[MetadataQuery], api_key: Option<&str>) -> Option<BookMetadata> {
        let provider = (self.build)(api_key)?;

        let mut last_error = None;

        for query in queries {
            if !provider.supports(query) {
                continue;
            }

            self.rate_limiter.lock().await.cooldown().await;

            match provider.fetch(query).await {
                Ok(metadata) => return Some(metadata),
                Err(e) => last_error = Some(e),
            }
        }

        if let Some(e) = last_error {
            warn!("Provider {} returned no metadata: {e}", self.provider_id);
        }

        None
    }
}

impl From<BookMetadata> for Metadata {
    fn from(metadata: BookMetadata) -> Self {
        let contributors = Some(metadata.contributors).filter(|c| !c.is_empty()).map(|c| {
            c.into_iter()
                .map(|contributor| Contributor {
                    name: contributor.name,
                    role: contributor.role,
                })
                .collect()
        });

        Self {
            title: Some(metadata.title),
            subtitle: metadata.subtitle,
            description: metadata.description,
            publisher: metadata.publisher,
            publication_date: metadata.publication_date,
            isbn: metadata.isbn,
            contributors,
            genres: Some(metadata.genres).filter(|g| !g.is_empty()),
            series: metadata.series.map(|series| Series {
                title: series.title,
                number: series.number,
            }),
            page_count: metadata.page_count,
            language: metadata.language,
        }
    }
}
