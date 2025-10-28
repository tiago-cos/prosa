use super::models::{Book, BookError, UploadBoodRequest};
use crate::app::{
    Config, ImageCache, LockManager, MetadataManager,
    authentication::models::AuthToken,
    books::{
        models::{BookFileMetadata, PaginatedBooks},
        service::BookService,
    },
    covers,
    epubs::service::EpubService,
    error::ProsaError,
    metadata, state, sync, users,
};
use std::{collections::HashMap, sync::Arc};

pub struct BookController {
    pub book_service: Arc<BookService>,
    pub lock_manager: LockManager,
    pub image_cache: Arc<ImageCache>,
    pub metadata_manager: MetadataManager,
    pub config: Config,
    pub epub_service: Arc<EpubService>,
}

impl BookController {
    pub fn new(
        book_service: Arc<BookService>,
        lock_manager: LockManager,
        image_cache: Arc<ImageCache>,
        metadata_manager: MetadataManager,
        config: Config,
        epub_service: Arc<EpubService>,
    ) -> Self {
        Self {
            book_service,
            lock_manager,
            image_cache,
            metadata_manager,
            config,
            epub_service,
        }
    }

    pub async fn download_book(&self, book_id: String) -> Result<Vec<u8>, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;
        let epub = self.epub_service.read_epub(&book.epub_id).await?;

        Ok(epub)
    }

    pub async fn get_book_file_metadata(&self, book_id: String) -> Result<BookFileMetadata, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;
        let file_size = self.epub_service.get_file_size(&book.epub_id).await;

        let metadata = BookFileMetadata {
            owner_id: book.owner_id,
            file_size,
        };

        Ok(metadata)
    }

    pub async fn upload_book(
        &self,
        token: AuthToken,
        data: UploadBoodRequest,
        pool: &sqlx::SqlitePool,
    ) -> Result<String, ProsaError> {
        let owner_id = match data.owner_id.as_deref() {
            Some(id) => id,
            None => token.role.get_user(),
        };

        let preferences = users::service::get_preferences(pool, owner_id).await?;
        let epub_id = self.epub_service.write_epub(&data.epub.to_vec()).await?;

        if self.book_service.epub_is_in_use_by_user(&epub_id, owner_id).await {
            return Err(BookError::BookConflict.into());
        }

        let state_id = state::service::initialize_state(pool).await;
        let book_sync_id = sync::service::initialize_book_sync(pool).await;

        let book = Book {
            owner_id: owner_id.to_string(),
            epub_id,
            metadata_id: None,
            cover_id: None,
            state_id,
            book_sync_id,
        };

        let book_id = self.book_service.add_book(&book).await?;

        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let automatic_metadata = preferences
            .automatic_metadata
            .expect("Metadata preference should be present");

        if automatic_metadata {
            self.metadata_manager
                .enqueue_request(
                    owner_id,
                    &book_id,
                    preferences.metadata_providers.unwrap_or(vec![]),
                )
                .await?;
        }

        Ok(book_id)
    }

    pub async fn delete_book(&self, book_id: String, pool: &sqlx::SqlitePool) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;
        self.book_service.delete_book(&book_id).await?;

        if let Some(metadata_id) = book.metadata_id {
            metadata::service::delete_metadata(pool, &metadata_id).await?;
        }

        if !self.book_service.epub_is_in_use(&book.epub_id).await {
            self.epub_service.delete_epub(&book.epub_id).await?;
        }

        let Some(cover_id) = book.cover_id else {
            return Ok(());
        };

        sync::service::update_book_delete_timestamp(pool, &book.book_sync_id).await;

        if !self.book_service.cover_is_in_use(&cover_id).await {
            covers::service::delete_cover(
                pool,
                &self.config.book_storage.cover_path,
                &cover_id,
                &self.image_cache,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn search_books(
        &self,
        params: HashMap<String, String>,
        pool: &sqlx::SqlitePool,
    ) -> Result<PaginatedBooks, ProsaError> {
        if let Some(username) = params.get("username") {
            users::service::get_user_by_username(pool, username).await?;
        }

        let page = match params.get("page").map(|t| t.parse::<i64>()) {
            Some(Ok(p)) => Some(p),
            None => None,
            _ => return Err(BookError::InvalidPagination.into()),
        };

        let size = match params.get("size").map(|t| t.parse::<i64>()) {
            Some(Ok(s)) => Some(s),
            None => None,
            _ => return Err(BookError::InvalidPagination.into()),
        };

        let books = self
            .book_service
            .search_books(
                params.get("username").map(ToString::to_string),
                params.get("title").map(ToString::to_string),
                params.get("author").map(ToString::to_string),
                page,
                size,
            )
            .await?;

        Ok(books)
    }
}
