use super::fetcher::MetadataFetcher;
use crate::{
    app::{
        books, covers, epubs,
        metadata::{self, models::Metadata},
        sync,
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

    //TODO when this panics, the program should still work
    pub async fn fetch_metadata(
        self: Arc<Self>,
        pool: Arc<SqlitePool>,
        book_id: String,
        providers: Vec<String>,
    ) -> () {
        let book = books::service::get_book(&pool, &book_id)
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

        match (book.metadata_id, metadata) {
            (_, None) => (),
            (Some(_), Some(metadata)) => handle_metadata_update(&pool, &book_id, metadata).await,
            (None, Some(metadata)) => handle_metadata_create(&pool, &book_id, metadata).await,
        };

        match (book.cover_id, image) {
            (_, None) => (),
            (Some(_), Some(image)) => handle_cover_update(&pool, &book_id, &self.cover_path, image).await,
            (None, Some(image)) => handle_cover_create(&pool, &book_id, &self.cover_path, image).await,
        };
    }
}

async fn handle_metadata_update(pool: &SqlitePool, book_id: &str, metadata: Metadata) -> () {
    let book = books::service::get_book(&pool, &book_id)
        .await
        .expect("Failed to get book");

    let metadata_id = book.metadata_id.expect("Failed to retrieve metadata id");
    metadata::service::update_metadata(&pool, &metadata_id, metadata)
        .await
        .expect("Failed to update metadata");

    sync::service::update_metadata_timestamp(&pool, &book.sync_id).await;
}

async fn handle_metadata_create(pool: &SqlitePool, book_id: &str, metadata: Metadata) -> () {
    let mut book = books::service::get_book(&pool, &book_id)
        .await
        .expect("Failed to get book");
    let sync_id = book.sync_id.clone();

    let metadata_id = metadata::service::add_metadata(&pool, metadata)
        .await
        .expect("Failed to add metadata");

    book.metadata_id = Some(metadata_id);
    books::service::update_book(&pool, &book_id, book)
        .await
        .expect("Failed to update book");

    sync::service::update_metadata_timestamp(&pool, &sync_id).await;
}

async fn handle_cover_update(pool: &SqlitePool, book_id: &str, cover_path: &str, cover: Vec<u8>) -> () {
    let mut book = books::service::get_book(&pool, &book_id)
        .await
        .expect("Failed to get book");
    let sync_id = book.sync_id.clone();

    let old_cover_id = book.cover_id.expect("Failed to retrieve old cover id");
    let new_cover_id = covers::service::write_cover(pool, &cover_path, &cover)
        .await
        .expect("Failed to write cover");

    book.cover_id = Some(new_cover_id);
    books::service::update_book(&pool, &book_id, book)
        .await
        .expect("Failed to update book");

    if !books::service::cover_is_in_use(&pool, &old_cover_id).await {
        covers::service::delete_cover(&pool, cover_path, &old_cover_id)
            .await
            .expect("Failed to delete unused cover");
    }

    sync::service::update_cover_timestamp(&pool, &sync_id).await;
}

async fn handle_cover_create(pool: &SqlitePool, book_id: &str, cover_path: &str, cover: Vec<u8>) -> () {
    let mut book = books::service::get_book(&pool, &book_id)
        .await
        .expect("Failed to get book");
    let sync_id = book.sync_id.clone();

    let cover_id = covers::service::write_cover(pool, &cover_path, &cover)
        .await
        .expect("Failed to write cover");

    book.cover_id = Some(cover_id);
    books::service::update_book(&pool, &book_id, book)
        .await
        .expect("Failed to update book");

    sync::service::update_cover_timestamp(&pool, &sync_id).await;
}
