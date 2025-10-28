use super::models::{NewAnnotationRequest, PatchAnnotationRequest};
use super::service;
use crate::app::annotations::models::Annotation;
use crate::app::books::service::BookService;
use crate::app::error::ProsaError;
use crate::app::{SourceCache, TagCache, TagLengthCache};
use crate::app::{concurrency::manager::ProsaLockManager, sync};
use sqlx::SqlitePool;
use std::sync::Arc;

pub struct AnnotationController {
    pool: SqlitePool,
    lock_manager: Arc<ProsaLockManager>,
    book_service: Arc<BookService>,
    source_cache: Arc<SourceCache>,
    tag_cache: Arc<TagCache>,
    tag_length_cache: Arc<TagLengthCache>,
    epub_path: String,
}

impl AnnotationController {
    pub fn new(
        pool: SqlitePool,
        lock_manager: Arc<ProsaLockManager>,
        book_service: Arc<BookService>,
        source_cache: Arc<SourceCache>,
        tag_cache: Arc<TagCache>,
        tag_length_cache: Arc<TagLengthCache>,
        epub_path: String,
    ) -> Self {
        Self {
            pool,
            lock_manager,
            book_service,
            source_cache,
            tag_cache,
            tag_length_cache,
            epub_path,
        }
    }

    pub async fn add_annotation(
        &self,
        book_id: &str,
        annotation: NewAnnotationRequest,
    ) -> Result<String, ProsaError> {
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;

        let annotation_id = service::add_annotation(
            &self.pool,
            book_id,
            annotation,
            &self.epub_path,
            &book.epub_id,
            &self.source_cache,
            &self.tag_cache,
            &self.tag_length_cache,
        )
        .await?;

        sync::service::update_annotations_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(annotation_id)
    }

    pub async fn get_annotation(&self, book_id: &str, annotation_id: &str) -> Result<Annotation, ProsaError> {
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        self.book_service.get_book(book_id).await?;
        let annotation = service::get_annotation(&self.pool, annotation_id).await?;

        Ok(annotation)
    }

    pub async fn list_annotations(&self, book_id: &str) -> Result<Vec<String>, ProsaError> {
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        self.book_service.get_book(book_id).await?;
        let annotations = service::get_annotations(&self.pool, book_id).await;

        Ok(annotations)
    }

    pub async fn delete_annotation(&self, book_id: &str, annotation_id: &str) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;
        service::delete_annotation(&self.pool, annotation_id).await?;

        sync::service::update_annotations_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(())
    }

    pub async fn patch_annotation(
        &self,
        book_id: &str,
        annotation_id: &str,
        request: PatchAnnotationRequest,
    ) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;
        service::patch_annotation(&self.pool, annotation_id, request.note).await?;

        sync::service::update_annotations_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(())
    }
}
