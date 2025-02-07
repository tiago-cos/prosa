use super::fetcher::MetadataFetcher;
use crate::{
    app::{
        books, covers, epubs,
        metadata::{self, models::Metadata},
    },
    config::Configuration,
};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct MetadataManager {
    fetcher: Mutex<MetadataFetcher>,
    epub_path: String,
    cover_path: String,
}

impl MetadataManager {
    pub fn new(config: &Configuration) -> Self {
        Self {
            fetcher: Mutex::new(MetadataFetcher::new(config)),
            epub_path: config.book_storage.epub_path.clone(),
            cover_path: config.book_storage.cover_path.clone(),
        }
    }

    pub async fn search_metadata(
        self: Arc<Self>,
        pool: Arc<SqlitePool>,
        book_id: String,
        providers: Vec<String>,
    ) -> () {
        let mut book = books::service::get_book(&pool, &book_id)
            .await
            .expect("Failed to get book");
        let epub_data = epubs::service::read_epub(&self.epub_path, &book.epub_id)
            .await
            .expect("Failed to download epub");

        let (metadata, image) = self
            .fetcher
            .lock()
            .await
            .fetch_metadata(epub_data, providers)
            .await;

        let metadata_id = match (book.metadata_id, metadata) {
            (id, None) => id,
            (Some(id), Some(metadata)) => handle_metadata_update(&pool, id, metadata).await,
            (None, Some(metadata)) => handle_metadata_create(&pool, metadata).await,
        };

        let cover_id = match (book.cover_id, image) {
            (id, None) => id,
            (Some(id), Some(image)) => handle_cover_update(&pool, &self.cover_path, id, image).await,
            (None, Some(image)) => handle_cover_create(&pool, &self.cover_path, image).await,
        };

        book.metadata_id = metadata_id;
        book.cover_id = cover_id;

        books::service::update_book(&pool, &book_id, book)
            .await
            .expect("Failed to update book");
    }
}

async fn handle_metadata_update(
    pool: &SqlitePool,
    metadata_id: String,
    metadata: Metadata,
) -> Option<String> {
    metadata::service::update_metadata(pool, &metadata_id, metadata)
        .await
        .expect("Failed to update metadata");

    Some(metadata_id)
}

async fn handle_metadata_create(pool: &SqlitePool, metadata: Metadata) -> Option<String> {
    let id = metadata::service::add_metadata(pool, metadata)
        .await
        .expect("Failed to add metadata");

    Some(id)
}

async fn handle_cover_update(
    pool: &SqlitePool,
    cover_path: &str,
    cover_id: String,
    cover: Vec<u8>,
) -> Option<String> {
    covers::service::delete_cover(pool, &cover_path, &cover_id)
        .await
        .expect("Failed to delete cover");
    let id = covers::service::write_cover(pool, &cover_path, &cover)
        .await
        .expect("Failed to write cover");

    Some(id)
}

async fn handle_cover_create(pool: &SqlitePool, cover_path: &str, cover: Vec<u8>) -> Option<String> {
    let id = covers::service::write_cover(pool, &cover_path, &cover)
        .await
        .expect("Failed to write cover");

    Some(id)
}
