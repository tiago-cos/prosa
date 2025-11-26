use super::models::{NewAnnotationRequest, PatchAnnotationRequest};
use crate::app::annotations::models::Annotation;
use crate::app::annotations::service::AnnotationService;
use crate::app::authentication::models::AuthToken;
use crate::app::books::service::BookService;
use crate::app::core::locking::service::LockService;
use crate::app::error::ProsaError;
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::sync::service::SyncService;
use axum::Json;
use axum::http::StatusCode;
use std::sync::Arc;

pub struct AnnotationController {
    lock_service: Arc<LockService>,
    book_service: Arc<BookService>,
    annotation_service: Arc<AnnotationService>,
    sync_service: Arc<SyncService>,
}

impl AnnotationController {
    pub fn new(
        lock_service: Arc<LockService>,
        book_service: Arc<BookService>,
        annotation_service: Arc<AnnotationService>,
        sync_service: Arc<SyncService>,
    ) -> Self {
        Self {
            lock_service,
            book_service,
            annotation_service,
            sync_service,
        }
    }

    pub async fn add_annotation(
        &self,
        token: AuthToken,
        book_id: &str,
        annotation: NewAnnotationRequest,
    ) -> Result<String, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;
        let annotation_id = self
            .annotation_service
            .add_annotation(book_id, annotation)
            .await?;

        self.sync_service
            .log_change(
                book_id,
                ChangeLogEntityType::BookAnnotations,
                ChangeLogAction::Create,
                &book.owner_id,
                &token.session_id,
            )
            .await;

        Ok(annotation_id)
    }

    pub async fn get_annotation(
        &self,
        book_id: &str,
        annotation_id: &str,
    ) -> Result<Json<Annotation>, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        self.book_service.get_book(book_id).await?;
        let annotation = self.annotation_service.get_annotation(annotation_id).await?;

        Ok(Json(annotation))
    }

    pub async fn list_annotations(&self, book_id: &str) -> Result<Json<Vec<String>>, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        self.book_service.get_book(book_id).await?;
        let annotations = self.annotation_service.get_annotations(book_id).await;

        Ok(Json(annotations))
    }

    pub async fn delete_annotation(
        &self,
        token: AuthToken,
        book_id: &str,
        annotation_id: &str,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;
        self.annotation_service.delete_annotation(annotation_id).await?;

        self.sync_service
            .log_change(
                book_id,
                ChangeLogEntityType::BookAnnotations,
                ChangeLogAction::Delete,
                &book.owner_id,
                &token.session_id,
            )
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn patch_annotation(
        &self,
        token: AuthToken,
        book_id: &str,
        annotation_id: &str,
        request: PatchAnnotationRequest,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;

        self.annotation_service
            .patch_annotation(annotation_id, request.note)
            .await?;

        self.sync_service
            .log_change(
                book_id,
                ChangeLogEntityType::BookAnnotations,
                ChangeLogAction::Update,
                &book.owner_id,
                &token.session_id,
            )
            .await;

        Ok(StatusCode::NO_CONTENT)
    }
}
