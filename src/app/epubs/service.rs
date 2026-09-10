use super::models::EpubError;
use crate::database::pool;
use crate::{
    CONFIG,
    app::{epubs::repository, server::LOCKS},
};
use base64::{Engine, prelude::BASE64_STANDARD};
use epub::doc::EpubDoc;
use sha2::{Digest, Sha256};
use std::io::Cursor;
use tokio::{
    fs::{self, File, remove_file},
    io::{AsyncReadExt, AsyncWriteExt},
};
use uuid::Uuid;

pub fn epub_path(epub_id: &str) -> String {
    format!("{}/{epub_id}.epub", CONFIG.book_storage.epub_path)
}

pub async fn write_epub(epub_data: &Vec<u8>) -> Result<String, EpubError> {
    if !is_valid_epub(epub_data) {
        return Err(EpubError::InvalidEpub);
    }

    let hash = BASE64_STANDARD.encode(Sha256::digest(epub_data));
    let lock = LOCKS.get_hash_lock(&hash).await;
    let _guard = lock.write().await;

    if let Some(epub_id) = repository::get_epub_by_hash(pool(), &hash).await {
        return Ok(epub_id);
    }

    let epub_id = Uuid::new_v4().to_string();
    let epub_file = epub_path(&epub_id);

    let mut file = File::create(&epub_file)
        .await
        .expect("Failed to create epub file");

    file.write_all(epub_data)
        .await
        .expect("Failed to write epub file to disk");

    file.sync_all().await.expect("Failed to sync epub file");

    repository::add_epub(pool(), &epub_id, &hash).await;

    Ok(epub_id)
}

pub async fn get_file_size(epub_id: &str) -> u32 {
    let metadata = fs::metadata(epub_path(epub_id))
        .await
        .expect("Failed to get file metadata");
    metadata.len().try_into().expect("Failed to get file size")
}

pub async fn read_epub(epub_id: &str) -> Result<Vec<u8>, EpubError> {
    let mut file = File::open(epub_path(epub_id)).await?;
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)
        .await
        .expect("Failed to read book file");

    Ok(buffer)
}

pub async fn remove_epub_file(epub_id: &str) -> Result<(), EpubError> {
    remove_file(epub_path(epub_id)).await?;

    Ok(())
}

fn is_valid_epub(epub_data: &Vec<u8>) -> bool {
    if epub_data.is_empty() {
        return false;
    }

    let cursor = Cursor::new(epub_data);
    if EpubDoc::from_reader(cursor).is_err() {
        return false;
    }

    true
}
