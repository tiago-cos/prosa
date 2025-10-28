use super::models::CoverError;
use crate::app::{ImageCache, concurrency::manager::ProsaLockManager, covers::repository::CoverRepository};
use base64::{Engine, prelude::BASE64_STANDARD};
use image::ImageFormat;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::{
    fs::{File, remove_file},
    io::{AsyncReadExt, AsyncWriteExt},
};
use uuid::Uuid;

pub struct CoverService {
    lock_manager: Arc<ProsaLockManager>,
    image_cache: Arc<ImageCache>,
    cover_path: String,
    cover_repository: Arc<CoverRepository>,
}

impl CoverService {
    pub fn new(
        lock_manager: Arc<ProsaLockManager>,
        image_cache: Arc<ImageCache>,
        cover_path: String,
        cover_repository: Arc<CoverRepository>,
    ) -> Self {
        Self {
            lock_manager,
            image_cache,
            cover_path,
            cover_repository,
        }
    }

    pub async fn write_cover(&self, cover_data: &Vec<u8>) -> Result<String, CoverError> {
        if !Self::is_valid_image(cover_data) {
            return Err(CoverError::InvalidCover);
        }

        let hash = BASE64_STANDARD.encode(Sha256::digest(cover_data));
        let lock = self.lock_manager.get_hash_lock(&hash).await;
        let _guard = lock.write().await;

        if let Some(cover_id) = self.cover_repository.get_cover_by_hash(&hash).await {
            return Ok(cover_id);
        }

        let cover_id = Uuid::new_v4().to_string();
        let cover_file = format!("{}/{}.jpeg", self.cover_path, cover_id);
        let mut file = File::create(&cover_file)
            .await
            .expect("Failed to create cover file");

        file.write_all(cover_data)
            .await
            .expect("Failed to write cover file to disk");

        file.sync_all().await.expect("Failed to sync cover file");

        self.cover_repository.add_cover(&cover_id, &hash).await;

        let cache_key = format!("images:{cover_id}");
        self.image_cache.insert(cache_key, Arc::new(cover_data.clone()));

        Ok(cover_id)
    }

    pub async fn read_cover(&self, cover_id: &str) -> Result<Vec<u8>, CoverError> {
        let cache_key = format!("images:{cover_id}");
        if let Some(image) = self.image_cache.get(&cache_key) {
            return Ok(image.to_vec());
        }

        let cover_file = format!("{}/{}.jpeg", self.cover_path, cover_id);
        let mut file = File::open(&cover_file).await?;
        let mut buffer = Vec::new();

        file.read_to_end(&mut buffer)
            .await
            .expect("Failed to read cover file");

        Ok(buffer)
    }

    pub async fn delete_cover(&self, cover_id: &str) -> Result<(), CoverError> {
        let cover_file = format!("{}/{}.jpeg", self.cover_path, cover_id);
        remove_file(&cover_file).await?;

        self.cover_repository.delete_cover(cover_id).await?;

        let cache_key = format!("images:{cover_id}");
        self.image_cache.remove(&cache_key);

        Ok(())
    }

    fn is_valid_image(cover_data: &[u8]) -> bool {
        matches!(
            image::guess_format(cover_data),
            Ok(ImageFormat::Png | ImageFormat::Jpeg)
        )
    }
}
