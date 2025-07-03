use super::fetcher::MetadataFetcher;
use crate::{
    app::{
        books,
        concurrency::manager::BookLockManager,
        covers, epubs,
        error::ProsaError,
        metadata::{self, models::Metadata},
        sync, ImageCache,
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

    pub async fn fetch_metadata(
        self: Arc<Self>,
        pool: Arc<SqlitePool>,
        lock_manager: Arc<BookLockManager>,
        image_cache: Arc<ImageCache>,
        book_id: String,
        providers: Vec<String>,
    ) -> () {
        let Ok(book) = books::service::get_book(&pool, &book_id).await else {
            return;
        };
        let Ok(epub_data) = epubs::service::read_epub(&self.epub_path, &book.epub_id).await else {
            return;
        };

        let (metadata, image) = self
            .fetcher
            .lock()
            .await
            .fetch_metadata(epub_data, providers)
            .await;

        let lock = lock_manager.get_lock(&book_id).await;
        let _guard = lock.write().await;

        let _ = match (book.metadata_id, metadata) {
            (_, None) => Ok(()),
            (Some(_), Some(metadata)) => handle_metadata_update(&pool, &book_id, metadata).await,
            (None, Some(metadata)) => handle_metadata_create(&pool, &book_id, metadata).await,
        };

        let _ = match (book.cover_id, image) {
            (_, None) => Ok(()),
            (Some(_), Some(image)) => {
                handle_cover_update(
                    &pool,
                    &book_id,
                    &self.cover_path,
                    image,
                    &lock_manager,
                    &image_cache,
                )
                .await
            }
            (None, Some(image)) => {
                handle_cover_create(
                    &pool,
                    &book_id,
                    &self.cover_path,
                    image,
                    &lock_manager,
                    &image_cache,
                )
                .await
            }
        };
    }
}

async fn handle_metadata_update(
    pool: &SqlitePool,
    book_id: &str,
    metadata: Metadata,
) -> Result<(), ProsaError> {
    let book = books::service::get_book(&pool, &book_id).await?;

    let metadata_id = book.metadata_id.expect("Failed to retrieve metadata id");
    metadata::service::update_metadata(&pool, &metadata_id, metadata).await?;

    sync::service::update_metadata_timestamp(&pool, &book.sync_id).await;

    Ok(())
}

//TODO in kobont, dont forget to update the book file size endpoint
async fn handle_metadata_create(
    pool: &SqlitePool,
    book_id: &str,
    metadata: Metadata,
) -> Result<(), ProsaError> {
    let mut book = books::service::get_book(&pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = metadata::service::add_metadata(&pool, metadata).await?;

    book.metadata_id = Some(metadata_id);
    books::service::update_book(&pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&pool, &sync_id).await;

    Ok(())
}

async fn handle_cover_update(
    pool: &SqlitePool,
    book_id: &str,
    cover_path: &str,
    cover: Vec<u8>,
    lock_manager: &BookLockManager,
    image_cache: &ImageCache,
) -> Result<(), ProsaError> {
    let mut book = books::service::get_book(&pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let old_cover_id = book.cover_id.expect("Failed to retrieve old cover id");
    let new_cover_id =
        covers::service::write_cover(pool, &cover_path, &cover, lock_manager, image_cache).await?;

    book.cover_id = Some(new_cover_id);
    books::service::update_book(&pool, &book_id, book).await?;

    if !books::service::cover_is_in_use(&pool, &old_cover_id).await {
        covers::service::delete_cover(&pool, cover_path, &old_cover_id, image_cache).await?;
    }

    sync::service::update_cover_timestamp(&pool, &sync_id).await;

    Ok(())
}

async fn handle_cover_create(
    pool: &SqlitePool,
    book_id: &str,
    cover_path: &str,
    cover: Vec<u8>,
    lock_manager: &BookLockManager,
    image_cache: &ImageCache,
) -> Result<(), ProsaError> {
    let mut book = books::service::get_book(&pool, &book_id).await?;
    let sync_id = book.sync_id.clone();
    let cover_id = covers::service::write_cover(pool, &cover_path, &cover, lock_manager, image_cache).await?;
    book.cover_id = Some(cover_id);
    books::service::update_book(&pool, &book_id, book).await?;

    sync::service::update_cover_timestamp(&pool, &sync_id).await;

    Ok(())
}
