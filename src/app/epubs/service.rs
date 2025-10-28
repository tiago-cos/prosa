use super::{models::EpubError, repository::EpubRepository};
use crate::app::concurrency::manager::ProsaLockManager;
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

pub struct EpubService {
    epub_repository: Arc<EpubRepository>,
    lock_manager: Arc<ProsaLockManager>,
    kepubify_path: String,
    epub_path: String,
}

impl EpubService {
    pub fn new(
        epub_repository: Arc<EpubRepository>,
        lock_manager: Arc<ProsaLockManager>,
        kepubify_path: String,
        epub_path: String,
    ) -> Self {
        Self {
            epub_repository,
            lock_manager,
            kepubify_path,
            epub_path,
        }
    }

    pub async fn write_epub(&self, epub_data: &Vec<u8>) -> Result<String, EpubError> {
        if !Self::is_valid_epub(epub_data) {
            return Err(EpubError::InvalidEpub);
        }

        let hash = BASE64_STANDARD.encode(Sha256::digest(epub_data));
        let lock = self.lock_manager.get_hash_lock(&hash).await;
        let _guard = lock.write().await;

        if let Some(epub_id) = self.epub_repository.get_epub_by_hash(&hash).await {
            return Ok(epub_id);
        }

        let epub_id = Uuid::new_v4().to_string();
        let epub_file = format!("{}/{epub_id}.epub", self.epub_path);

        let mut file = File::create(&epub_file)
            .await
            .expect("Failed to create epub file");

        file.write_all(epub_data)
            .await
            .expect("Failed to write epub file to disk");

        file.sync_all().await.expect("Failed to sync epub file");

        self.convert_to_kepub(&epub_file).await;
        self.epub_repository.add_epub(&epub_id, &hash).await;

        Ok(epub_id)
    }

    pub async fn get_file_size(&self, epub_id: &str) -> u32 {
        let epub_file = format!("{}/{}.kepub.epub", self.epub_path, epub_id);
        let metadata = fs::metadata(epub_file)
            .await
            .expect("Failed to get file metadata");
        metadata.len().try_into().expect("Failed to get file size")
    }

    pub async fn read_epub(&self, epub_id: &str) -> Result<Vec<u8>, EpubError> {
        let epub_file = format!("{}/{}.kepub.epub", self.epub_path, epub_id);
        let mut file = File::open(epub_file).await?;
        let mut buffer = Vec::new();

        file.read_to_end(&mut buffer)
            .await
            .expect("Failed to read book file");

        Ok(buffer)
    }

    pub async fn delete_epub(&self, epub_id: &str) -> Result<(), EpubError> {
        let epub_file = format!("{}/{}.kepub.epub", self.epub_path, epub_id);
        remove_file(epub_file).await?;

        self.epub_repository.delete_epub(epub_id).await?;

        Ok(())
    }

    async fn convert_to_kepub(&self, epub_file: &str) {
        let output = Command::new(&self.kepubify_path)
            .args([
                "--smarten-punctuation",
                "--fullscreen-reading-fixes",
                "-o",
                &self.epub_path,
                "-i",
                epub_file,
            ])
            .output()
            .await
            .expect("Failed to convert to kepub");

        assert!(output.status.success(), "Failed to convert to kepub");

        remove_file(epub_file).await.expect("Failed to convert to kepub");
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
}
