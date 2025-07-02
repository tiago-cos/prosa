use std::{collections::HashMap, sync::Arc};

use tokio::sync::{Mutex, RwLock};

pub struct BookLockManager {
    locks: Mutex<HashMap<String, Arc<RwLock<()>>>>,
}

impl BookLockManager {
    pub fn new() -> Self {
        Self {
            locks: Mutex::new(HashMap::new()),
        }
    }

    pub async fn get_lock(&self, id: &str) -> Arc<RwLock<()>> {
        let mut map = self.locks.lock().await;
        map.entry(id.to_string())
            .or_insert_with(|| Arc::new(RwLock::new(())))
            .clone()
    }

    pub async fn delete_lock(&self, id: &str) -> () {
        let mut map = self.locks.lock().await;
        map.remove(id);
    }
}
