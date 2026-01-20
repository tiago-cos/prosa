use super::models::CoverError;
use crate::{
    CONFIG,
    app::{
        covers::repository,
        server::{CACHE, LOCKS},
    },
};
use base64::{Engine, prelude::BASE64_STANDARD};
use image::ImageFormat;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::{
    fs::{File, remove_file},
    io::{AsyncReadExt, AsyncWriteExt},
};
use uuid::Uuid;

pub async fn write_cover(cover_data: &Vec<u8>) -> Result<String, CoverError> {
    if !is_valid_image(cover_data) {
        return Err(CoverError::InvalidCover);
    }

    let hash = BASE64_STANDARD.encode(Sha256::digest(cover_data));
    let lock = LOCKS.get_hash_lock(&hash).await;
    let _guard = lock.write().await;

    if let Some(cover_id) = repository::get_cover_by_hash(&hash).await {
        return Ok(cover_id);
    }

    let cover_id = Uuid::new_v4().to_string();
    let cover_file = format!("{}/{}.jpeg", CONFIG.book_storage.cover_path, cover_id);
    let mut file = File::create(&cover_file)
        .await
        .expect("Failed to create cover file");

    file.write_all(cover_data)
        .await
        .expect("Failed to write cover file to disk");

    file.sync_all().await.expect("Failed to sync cover file");

    repository::add_cover(&cover_id, &hash).await;

    let cache_key = format!("images:{cover_id}");
    CACHE.image_cache.insert(cache_key, Arc::new(cover_data.clone()));

    Ok(cover_id)
}

pub async fn read_cover(cover_id: &str) -> Result<Vec<u8>, CoverError> {
    let cache_key = format!("images:{cover_id}");
    if let Some(image) = CACHE.image_cache.get(&cache_key) {
        return Ok(image.to_vec());
    }

    let cover_file = format!("{}/{}.jpeg", CONFIG.book_storage.cover_path, cover_id);
    let mut file = File::open(&cover_file).await?;
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)
        .await
        .expect("Failed to read cover file");

    Ok(buffer)
}

pub async fn delete_cover(cover_id: &str) -> Result<(), CoverError> {
    let cover_file = format!("{}/{}.jpeg", CONFIG.book_storage.cover_path, cover_id);
    remove_file(&cover_file).await?;

    repository::delete_cover(cover_id).await?;

    let cache_key = format!("images:{cover_id}");
    CACHE.image_cache.remove(&cache_key);

    Ok(())
}

fn is_valid_image(cover_data: &[u8]) -> bool {
    if cover_data.len() > 10485760 {
        return false;
    }

    matches!(
        image::guess_format(cover_data),
        Ok(ImageFormat::Png | ImageFormat::Jpeg)
    )
}
