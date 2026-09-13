use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};
use tokio::sync::{Mutex, RwLock};

/// Per-key locks, handed out by name and dropped once nobody holds one. Keys
/// are namespaced by what they identify, so a book and a shelf sharing an id do
/// not share a lock. Where two are held at once they are taken in this order --
/// book, then shelf, hash or annotation -- and never the other way round.
pub struct LockService {
    locks: Mutex<HashMap<String, Weak<RwLock<()>>>>,
    cleaning_threshold: usize,
}

impl LockService {
    pub fn new(cleaning_threshold: usize) -> Self {
        Self {
            locks: Mutex::new(HashMap::new()),
            cleaning_threshold,
        }
    }

    pub async fn get_hash_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let key = format!("hash:{key}");
        self.get_lock(&key).await
    }

    pub async fn get_shelf_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let key = format!("shelf:{key}");
        self.get_lock(&key).await
    }

    pub async fn get_book_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let key = format!("book:{key}");
        self.get_lock(&key).await
    }

    pub async fn get_annotation_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let key = format!("annotation:{key}");
        self.get_lock(&key).await
    }

    pub async fn get_user_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let key = format!("user:{key}");
        self.get_lock(&key).await
    }

    pub async fn get_key_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let key = format!("key:{key}");
        self.get_lock(&key).await
    }

    async fn get_lock(&self, key: &str) -> Arc<RwLock<()>> {
        let mut map = self.locks.lock().await;

        if let Some(weak_lock) = map.get(key)
            && let Some(strong_lock) = weak_lock.upgrade()
        {
            return strong_lock;
        }

        if map.len() >= self.cleaning_threshold {
            map.retain(|_, weak_ref| weak_ref.strong_count() > 0);
        }

        let new_lock = Arc::new(RwLock::new(()));
        map.insert(key.to_string(), Arc::downgrade(&new_lock));
        new_lock
    }
}
