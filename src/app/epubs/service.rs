use super::models::EpubError;
use crate::app::{concurrency::manager::ProsaLockManager, epubs::repository::EpubRepository};
use base64::{Engine, prelude::BASE64_STANDARD};
use epub::doc::EpubDoc;
use sha2::{Digest, Sha256};
use std::{io::Cursor, sync::Arc};
use tokio::{
    fs::{self, File, remove_file},
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
};
use uuid::Uuid;

pub async fn write_epub(
    kepubify_path: &str,
    epub_path: &str,
    epub_data: &Vec<u8>,
    lock_manager: &ProsaLockManager,
    repo: Arc<EpubRepository>,
) -> Result<String, EpubError> {
    if !is_valid_epub(epub_data) {
        return Err(EpubError::InvalidEpub);
    }

    let hash = BASE64_STANDARD.encode(Sha256::digest(epub_data));

    let lock = lock_manager.get_hash_lock(&hash).await;
    let _guard = lock.write().await;

    if let Some(epub_id) = repo.get_epub_by_hash(&hash).await {
        return Ok(epub_id);
    }

    let epub_id = Uuid::new_v4().to_string();
    let epub_file = format!("{epub_path}/{epub_id}.epub");
    let mut file = File::create(&epub_file)
        .await
        .expect("Failed to create epub file");

    file.write_all(epub_data)
        .await
        .expect("Failed to write epub file to disk");

    file.sync_all().await.expect("Failed to sync epub file");

    convert_to_kepub(kepubify_path, epub_path, &epub_file).await;

    repo.add_epub(&epub_id, &hash).await;

    Ok(epub_id)
}

async fn convert_to_kepub(kepubify_path: &str, epub_path: &str, epub_file: &str) {
    let output = Command::new(kepubify_path)
        .args([
            "--smarten-punctuation",
            "--fullscreen-reading-fixes",
            "-o",
            epub_path,
            "-i",
            epub_file,
        ])
        .output()
        .await
        .expect("Failed to convert to kepub");

    assert!(output.status.success(), "Failed to convert to kepub");

    remove_file(epub_file).await.expect("Failed to convert to kepub");
}

pub async fn get_file_size(epub_path: &str, epub_id: &str) -> u32 {
    let epub_file = format!("{epub_path}/{epub_id}.kepub.epub");
    let metadata = fs::metadata(epub_file)
        .await
        .expect("Failed to get file metadata");
    metadata.len().try_into().expect("Failed to get file size")
}

pub async fn read_epub(epub_path: &str, epub_id: &str) -> Result<Vec<u8>, EpubError> {
    let epub_file = format!("{epub_path}/{epub_id}.kepub.epub");
    let mut file = File::open(epub_file).await?;
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)
        .await
        .expect("Failed to read book file");

    Ok(buffer)
}

pub async fn delete_epub(epub_path: &str, epub_id: &str, repo: Arc<EpubRepository>) -> Result<(), EpubError> {
    let epub_file = format!("{epub_path}/{epub_id}.kepub.epub");
    remove_file(epub_file).await?;

    repo.delete_epub(epub_id).await?;

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
