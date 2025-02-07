use super::{data, models::EpubError};
use base64::{prelude::BASE64_STANDARD, Engine};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use tokio::{
    fs::{remove_file, File},
    io::{AsyncReadExt, AsyncWriteExt},
};
use uuid::Uuid;

pub async fn write_epub(
    pool: &SqlitePool,
    epub_path: &str,
    epub_data: &Vec<u8>,
) -> Result<String, EpubError> {
    if epub_data.is_empty() {
        return Err(EpubError::InvalidEpub);
    }

    let hash = BASE64_STANDARD.encode(Sha256::digest(epub_data));
    if let Some(epub_id) = data::get_epub_by_hash(pool, &hash).await {
        return Ok(epub_id);
    }

    let epub_id = Uuid::new_v4().to_string();
    let epub_file = format!("{}/{}.epub", epub_path, epub_id);
    let mut file = File::create(epub_file).await.expect("Failed to create epub file");

    file.write_all(epub_data)
        .await
        .expect("Failed to write epub file to disk");

    file.sync_all().await.expect("Failed to sync epub file");

    data::add_epub(pool, &epub_id, &hash).await;

    Ok(epub_id)
}

pub async fn read_epub(epub_path: &str, epub_id: &str) -> Result<Vec<u8>, EpubError> {
    let epub_file = format!("{}/{}.epub", epub_path, epub_id);

    let mut file = File::open(epub_file).await?;
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)
        .await
        .expect("Failed to read book file");

    Ok(buffer)
}

pub async fn delete_epub(pool: &SqlitePool, epub_path: &str, epub_id: &str) -> Result<(), EpubError> {
    let epub_file = format!("{}/{}.epub", epub_path, epub_id);
    remove_file(epub_file).await?;

    data::delete_epub(pool, &epub_id).await?;

    Ok(())
}
