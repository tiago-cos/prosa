use super::models::{BookEntity, BookError, PaginatedBookResponse};
use crate::app::{
    books::repository,
    covers, epubs,
    error::ProsaError,
    metadata, state,
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
};
use crate::database::pool;
use std::str::FromStr;
use uuid::Uuid;

pub async fn get_book(book_id: &str) -> Result<BookEntity, ProsaError> {
    let book = repository::get_book(pool(), book_id).await?;
    Ok(book)
}

pub async fn create_book(
    owner_id: &str,
    epub_id: String,
    book_id: Option<String>,
    session_id: &str,
) -> Result<String, ProsaError> {
    let book_id = book_id
        .map(|id| Uuid::from_str(&id))
        .transpose()
        .map_err(|_| BookError::InvalidBookId)?
        .unwrap_or_else(Uuid::new_v4)
        .to_string();

    let mut tx = pool().begin().await.map_err(BookError::from)?;

    let book = BookEntity {
        owner_id: owner_id.to_string(),
        epub_id,
        metadata_id: None,
        cover_id: None,
    };

    repository::add_book(&mut *tx, &book_id, &book).await?;

    state::service::initialize_state(&mut tx, &book_id).await;

    sync::service::log_change_in(
        &mut tx,
        &book_id,
        ChangeLogEntityType::BookFile,
        ChangeLogAction::Create,
        owner_id,
        session_id,
    )
    .await;

    tx.commit().await.map_err(BookError::from)?;

    Ok(book_id)
}

pub async fn update_book(book_id: &str, book: &BookEntity) -> Result<(), ProsaError> {
    repository::update_book(pool(), book_id, book).await?;
    Ok(())
}

pub struct OrphanedFiles {
    pub epub_id: Option<String>,
    pub cover_id: Option<String>,
}

pub async fn delete_book_cascade(book_id: &str, session_id: &str) -> Result<OrphanedFiles, ProsaError> {
    let mut tx = pool().begin().await.map_err(BookError::from)?;

    let book = repository::get_book(&mut *tx, book_id).await?;
    repository::delete_book(&mut *tx, book_id).await?;

    if let Some(metadata_id) = &book.metadata_id {
        metadata::repository::delete_metadata(&mut *tx, metadata_id).await?;
    }

    let mut epub_id = None;
    if repository::get_books_by_epub(&mut *tx, &book.epub_id)
        .await
        .is_empty()
    {
        epubs::repository::delete_epub(&mut *tx, &book.epub_id).await?;
        epub_id = Some(book.epub_id.clone());
    }

    let mut cover_id = None;
    if let Some(id) = &book.cover_id
        && repository::get_books_by_cover(&mut *tx, id).await.is_empty()
    {
        covers::repository::delete_cover(&mut *tx, id).await?;
        cover_id = Some(id.clone());
    }

    sync::service::log_change_in(
        &mut tx,
        book_id,
        ChangeLogEntityType::BookFile,
        ChangeLogAction::Delete,
        &book.owner_id,
        session_id,
    )
    .await;

    tx.commit().await.map_err(BookError::from)?;

    Ok(OrphanedFiles { epub_id, cover_id })
}

pub async fn search_books(
    username: Option<String>,
    title: Option<String>,
    author: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedBookResponse, ProsaError> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);

    if page <= 0 || page_size <= 0 {
        return Err(BookError::InvalidPagination.into());
    }

    let result = repository::get_paginated_books(pool(), page, page_size, username, title, author).await;
    Ok(result)
}

pub async fn cover_is_in_use(cover_id: &str) -> bool {
    let books = repository::get_books_by_cover(pool(), cover_id).await;
    !books.is_empty()
}

pub async fn epub_is_in_use_by_user(epub_id: &str, user_id: &str) -> bool {
    repository::epub_belongs_to_user(pool(), epub_id, user_id).await
}

pub async fn book_exists(book_id: &str) -> bool {
    let book = repository::get_book(pool(), book_id).await;
    book.is_ok()
}
