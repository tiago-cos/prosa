use super::providers::{epub_extractor::EpubExtractor, goodreads::GoodreadsMetadataScraper};
use crate::{app::metadata::models::Metadata, config::Configuration};
use async_trait::async_trait;
use merge::Merge;
use std::collections::HashMap;

#[async_trait]
pub trait MetadataProvider: Send + Sync {
    async fn fetch_metadata(&mut self, epub_data: &Vec<u8>) -> (Option<Metadata>, Option<Vec<u8>>);
}

pub struct MetadataFetcher {
    providers: HashMap<String, Box<dyn MetadataProvider>>,
}

impl MetadataFetcher {
    pub fn new(config: &Configuration) -> Self {
        let goodreads_scraper = GoodreadsMetadataScraper::new(config.metadata_cooldown.goodreads);
        let epub_extractor = EpubExtractor::new(config.metadata_cooldown.epub_extractor);
        let mut providers: HashMap<String, Box<dyn MetadataProvider>> = HashMap::new();

        providers.insert(
            "goodreads_metadata_scraper".to_string(),
            Box::new(goodreads_scraper) as Box<dyn MetadataProvider>,
        );

        providers.insert(
            "epub_metadata_extractor".to_string(),
            Box::new(epub_extractor) as Box<dyn MetadataProvider>,
        );

        Self { providers }
    }

    pub async fn fetch_metadata(
        &mut self,
        epub_data: Vec<u8>,
        providers: Vec<String>,
    ) -> (Option<Metadata>, Option<Vec<u8>>) {
        let mut metadata = Metadata::default();
        let mut image: Vec<u8> = Vec::new();

        for provider in providers {
            let Some(provider) = self.providers.get_mut(&provider) else {
                continue;
            };
            let (m, i) = provider.fetch_metadata(&epub_data).await;

            if let Some(m) = m {
                metadata.merge(m);
            }

            if let Some(i) = i {
                if i.len() > image.len() {
                    image = i;
                }
            }
        }

        let metadata = if metadata.is_empty() { None } else { Some(metadata) };
        let image = if image.is_empty() { None } else { Some(image) };

        (metadata, image)
    }
}
