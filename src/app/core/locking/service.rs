use std::{
    collections::HashMap,
    sync::{Arc, Weak},
};
use tokio::sync::{Mutex, RwLock};

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
