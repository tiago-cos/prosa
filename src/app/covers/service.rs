use super::{data, models::CoverError};
use base64::{prelude::BASE64_STANDARD, Engine};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use tokio::{
    fs::{remove_file, File},
    io::{AsyncReadExt, AsyncWriteExt},
};
use uuid::Uuid;

pub async fn write_cover(
    pool: &SqlitePool,
    cover_path: &str,
    cover_data: &Vec<u8>,
) -> Result<String, CoverError> {
    let hash = BASE64_STANDARD.encode(Sha256::digest(cover_data));
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

    Ok(cover_id)
}

pub async fn read_cover(cover_path: &str, cover_id: &str) -> Result<Vec<u8>, CoverError> {
    let cover_file = format!("{}/{}.jpeg", cover_path, cover_id);

    let mut file = File::open(cover_file).await?;
    let mut buffer = Vec::new();

    file.read_to_end(&mut buffer)
        .await
        .expect("Failed to read cover file");

    Ok(buffer)
}

pub async fn delete_cover(pool: &SqlitePool, cover_path: &str, cover_id: &str) -> Result<(), CoverError> {
    let cover_file = format!("{}/{}.jpeg", cover_path, cover_id);
    remove_file(cover_file).await?;

    data::delete_cover(pool, &cover_id).await?;

    Ok(())
}
