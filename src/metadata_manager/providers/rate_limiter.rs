use tokio::time::{sleep, Duration, Instant};

pub struct RateLimiter {
    last_request: Instant,
    cooldown: Duration,
}

impl RateLimiter {
    pub fn new(cooldown: u64) -> Self {
        Self {
            last_request: Instant::now(),
            cooldown: Duration::from_millis(cooldown),
        }
    }

    pub async fn cooldown(&mut self) {
        let elapsed_time = Instant::now().duration_since(self.last_request);

        if elapsed_time < self.cooldown {
            sleep(self.cooldown - elapsed_time).await;
        }

        self.last_request = Instant::now();
    }
}
