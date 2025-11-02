use crate::app::{
    books::service::BookService,
    error::ProsaError,
    shelves::{
        models::{PaginatedShelves, Shelf, ShelfError, ShelfMetadata},
        repository::ShelfRepository,
    },
};
use std::sync::Arc;
use uuid::Uuid;

pub struct ShelfService {
    shelf_repository: Arc<ShelfRepository>,
    book_service: Arc<BookService>,
}

impl ShelfService {
    pub fn new(shelf_repository: Arc<ShelfRepository>, book_service: Arc<BookService>) -> Self {
        Self {
            shelf_repository,
            book_service,
        }
    }

    pub async fn get_shelf(&self, shelf_id: &str) -> Result<Shelf, ProsaError> {
        let shelf = self.shelf_repository.get_shelf(shelf_id).await?;
        Ok(shelf)
    }

    pub async fn get_shelf_by_name_and_owner(&self, shelf_name: &str, owner_id: &str) -> Option<Shelf> {
        self.shelf_repository
            .get_shelf_by_name_and_owner(shelf_name, owner_id)
            .await
    }

    pub async fn get_shelf_metadata(&self, shelf_id: &str) -> Result<ShelfMetadata, ProsaError> {
        let shelf = self.shelf_repository.get_shelf(shelf_id).await?;
        let book_count = self.shelf_repository.get_shelf_book_count(shelf_id).await;

        let metadata = ShelfMetadata {
            name: shelf.name,
            owner_id: shelf.owner_id,
            book_count,
        };

        Ok(metadata)
    }

    pub async fn add_shelf(&self, shelf: Shelf) -> Result<String, ProsaError> {
        Self::verify_shelf_name(&shelf.name)?;

        let shelf_id = Uuid::new_v4().to_string();
        self.shelf_repository.add_shelf(&shelf_id, shelf).await?;

        Ok(shelf_id)
    }

    pub async fn update_shelf(&self, shelf_id: &str, name: &str) -> Result<(), ProsaError> {
        Self::verify_shelf_name(name)?;
        self.shelf_repository.update_shelf(shelf_id, name).await?;
        Ok(())
    }

    pub async fn delete_shelf(&self, shelf_id: &str) -> Result<(), ProsaError> {
        self.shelf_repository.delete_shelf(shelf_id).await?;
        Ok(())
    }

    pub async fn search_shelves(
        &self,
        username: Option<String>,
        name: Option<String>,
        page: Option<i64>,
        page_size: Option<i64>,
    ) -> Result<PaginatedShelves, ProsaError> {
        let page = page.unwrap_or(1);
        let page_size = page_size.unwrap_or(10);

        if page <= 0 || page_size <= 0 {
            return Err(ShelfError::InvalidPagination.into());
        }

        Ok(self
            .shelf_repository
            .get_paginated_shelves(page, page_size, username, name)
            .await)
    }

    pub async fn add_book_to_shelf(&self, shelf_id: &str, book_id: &str) -> Result<(), ProsaError> {
        // Verify if book and shelf exist
        self.book_service.get_book(book_id).await?;
        self.get_shelf_metadata(shelf_id).await?;

        self.shelf_repository.add_book_to_shelf(shelf_id, book_id).await?;
        Ok(())
    }

    pub async fn list_shelf_books(&self, shelf_id: &str) -> Result<Vec<String>, ProsaError> {
        // Verify if the shelf exists
        self.get_shelf_metadata(shelf_id).await?;

        let books = self.shelf_repository.get_shelf_books(shelf_id).await;
        Ok(books)
    }

    pub async fn delete_book_from_shelf(&self, shelf_id: &str, book_id: &str) -> Result<(), ProsaError> {
        // Verify if the shelf exists
        self.get_shelf_metadata(shelf_id).await?;

        self.shelf_repository
            .delete_book_from_shelf(shelf_id, book_id)
            .await?;
        Ok(())
    }

    fn verify_shelf_name(name: &str) -> Result<(), ShelfError> {
        if !name.chars().all(|c| (' '..='~').contains(&c)) {
            return Err(ShelfError::InvalidName);
        }

        if name.len() > 30 {
            return Err(ShelfError::InvalidName);
        }

        Ok(())
    }
}
