use super::providers::{epub_extractor::EpubExtractor, goodreads::GoodreadsMetadataScraper};
use crate::{app::metadata::models::Metadata, config::Configuration};
use async_trait::async_trait;
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
        for provider in providers {
            let provider = match self.providers.get_mut(&provider) {
                None => continue,
                Some(provider) => provider,
            };

            match provider.fetch_metadata(&epub_data).await {
                (None, _) => continue,
                (metadata, image) => return (metadata, image),
            }
        }
        (None, None)
    }
}
