use super::models::{BookEntity, BookError, PaginatedBookResponse};
use crate::app::{
    books::{models::OrphanedFiles, repository},
    core::{ids, pagination::Pagination},
    covers::{self, models::CoverError},
    epubs,
    error::ProsaError,
    state,
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
};
use crate::database::pool;

/// Separate from `create_book` because the book's lock is keyed on the id, so
/// the caller needs it settled before the book exists.
pub fn resolve_book_id(book_id: Option<String>) -> Result<String, ProsaError> {
    ids::resolve(book_id).map_err(|_| BookError::InvalidBookId.into())
}

pub async fn get_book(book_id: &str) -> Result<BookEntity, ProsaError> {
    let book = repository::get_book(pool(), book_id).await?;
    Ok(book)
}

pub async fn create_book(
    owner_id: &str,
    epub_id: String,
    book_id: &str,
    session_id: &str,
) -> Result<(), ProsaError> {
    let mut tx = pool().begin().await.map_err(BookError::from)?;

    let book = BookEntity {
        owner_id: owner_id.to_string(),
        epub_id,
        cover_id: None,
    };

    repository::add_book(&mut *tx, book_id, &book).await?;

    state::service::initialize_state(&mut tx, book_id).await;

    sync::service::log_change_in(
        &mut tx,
        book_id,
        ChangeLogEntityType::BookFile,
        ChangeLogAction::Create,
        owner_id,
        session_id,
    )
    .await;

    tx.commit().await.map_err(BookError::from)?;

    Ok(())
}

pub async fn update_book(book_id: &str, book: &BookEntity) -> Result<(), ProsaError> {
    repository::update_book(pool(), book_id, book).await?;
    Ok(())
}

pub async fn delete_book_cascade(book_id: &str, session_id: &str) -> Result<OrphanedFiles, ProsaError> {
    let mut tx = pool().begin().await.map_err(BookError::from)?;

    let book = repository::get_book(&mut *tx, book_id).await?;
    repository::delete_book(&mut *tx, book_id).await?;

    let epub_id = if repository::get_books_by_epub(&mut *tx, &book.epub_id)
        .await
        .is_empty()
    {
        epubs::repository::delete_epub(&mut *tx, &book.epub_id).await?;
        Some(book.epub_id.clone())
    } else {
        None
    };

    let cover_id = if let Some(id) = &book.cover_id
        && repository::get_books_by_cover(&mut *tx, id).await.is_empty()
    {
        covers::repository::delete_cover(&mut *tx, id).await?;
        Some(id.clone())
    } else {
        None
    };

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
    pagination: &Pagination,
) -> PaginatedBookResponse {
    repository::get_paginated_books(pool(), pagination.page, pagination.size, username, title, author).await
}

pub async fn get_cover(book_id: &str) -> Result<Vec<u8>, ProsaError> {
    let book = get_book(book_id).await?;

    let Some(cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    let cover = covers::service::read_cover(&cover_id).await?;
    Ok(cover)
}

pub async fn attach_cover(book_id: &str, cover_data: &[u8], session_id: &str) -> Result<(), ProsaError> {
    let book = get_book(book_id).await?;

    if book.cover_id.is_some() {
        return Err(CoverError::CoverConflict.into());
    }

    store_cover(book_id, book, cover_data, session_id).await
}

pub async fn replace_cover(book_id: &str, cover_data: &[u8], session_id: &str) -> Result<(), ProsaError> {
    let book = get_book(book_id).await?;

    if book.cover_id.is_none() {
        return Err(CoverError::CoverNotFound.into());
    }

    store_cover(book_id, book, cover_data, session_id).await
}

pub async fn set_cover(book_id: &str, cover_data: &[u8], session_id: &str) -> Result<(), ProsaError> {
    let book = get_book(book_id).await?;
    store_cover(book_id, book, cover_data, session_id).await
}

pub async fn detach_cover(book_id: &str, session_id: &str) -> Result<(), ProsaError> {
    let mut book = get_book(book_id).await?;

    let Some(previous) = book.cover_id.take() else {
        return Err(CoverError::CoverNotFound.into());
    };

    update_book(book_id, &book).await?;
    discard_cover(&previous).await?;

    sync::service::log_change(
        book_id,
        ChangeLogEntityType::BookCover,
        ChangeLogAction::Delete,
        &book.owner_id,
        session_id,
    )
    .await;

    Ok(())
}

async fn store_cover(
    book_id: &str,
    mut book: BookEntity,
    cover_data: &[u8],
    session_id: &str,
) -> Result<(), ProsaError> {
    let previous = book.cover_id.take();

    book.cover_id = Some(covers::service::write_cover(&cover_data.to_vec()).await?);
    update_book(book_id, &book).await?;

    let action = match previous {
        Some(previous) => {
            discard_cover(&previous).await?;
            ChangeLogAction::Update
        }
        None => ChangeLogAction::Create,
    };

    sync::service::log_change(
        book_id,
        ChangeLogEntityType::BookCover,
        action,
        &book.owner_id,
        session_id,
    )
    .await;

    Ok(())
}

async fn discard_cover(cover_id: &str) -> Result<(), ProsaError> {
    if !cover_is_in_use(cover_id).await {
        covers::service::delete_cover(cover_id).await?;
    }

    Ok(())
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
