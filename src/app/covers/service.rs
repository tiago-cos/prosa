use super::{data, models::CoverError};
use crate::app::{concurrency::manager::ProsaLockManager, ImageCache};
use base64::{prelude::BASE64_STANDARD, Engine};
use image::ImageFormat;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::{
    fs::{remove_file, File},
    io::{AsyncReadExt, AsyncWriteExt},
};
use uuid::Uuid;

pub async fn write_cover(
    pool: &SqlitePool,
    cover_path: &str,
    cover_data: &Vec<u8>,
    lock_manager: &ProsaLockManager,
    image_cache: &ImageCache,
) -> Result<String, CoverError> {
    if !is_valid_image(cover_data).await {
        return Err(CoverError::InvalidCover);
    }

    let hash = BASE64_STANDARD.encode(Sha256::digest(cover_data));

    let lock = lock_manager.get_hash_lock(&hash).await;
    let _guard = lock.write().await;

    if let Some(cover_id) = data::get_cover_by_hash(pool, &hash).await {
        return Ok(cover_id);
    }

    let cover_id = Uuid::new_v4().to_string();
    let cover_file = format!("{}/{}.jpeg", cover_path, cover_id);
    let mut file = File::create(cover_file)
        .await
        .expect("Failed to create cover file");

    file.write_all(cover_data)
        .await
        .expect("Failed to write cover file to disk");

    file.sync_all().await.expect("Failed to sync cover file");

    data::add_cover(pool, &cover_id, &hash).await;

    let cache_key = format!("images:{}", cover_id);
    image_cache.insert(cache_key, Arc::new(cover_data.to_vec()));

    Ok(cover_id)
}

pub async fn read_cover(
    cover_path: &str,
    cover_id: &str,
    image_cache: &ImageCache,
) -> Result<Vec<u8>, CoverError> {
    let cache_key = format!("images:{}", cover_id);
    match image_cache.get(&cache_key) {
        Some(image) => return Ok(image.to_vec()),
        None => (),
    };

    let cover_file = format!("{}/{}.jpeg", cover_path, cover_id);

    let mut file = File::open(cover_file).await?;
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)
        .await
        .expect("Failed to read cover file");

    Ok(buffer)
}

pub async fn delete_cover(
    pool: &SqlitePool,
    cover_path: &str,
    cover_id: &str,
    image_cache: &ImageCache,
) -> Result<(), CoverError> {
    let cover_file = format!("{}/{}.jpeg", cover_path, cover_id);
    remove_file(cover_file).await?;

    data::delete_cover(pool, &cover_id).await?;

    let cache_key = format!("images:{}", cover_id);
    image_cache.remove(&cache_key);

    Ok(())
}

async fn is_valid_image(cover_data: &Vec<u8>) -> bool {
    match image::guess_format(&cover_data) {
        Ok(ImageFormat::Png) => true,
        Ok(ImageFormat::Jpeg) => true,
        _ => false,
    }
}
