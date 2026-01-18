use tokio::time::{Duration, Instant, sleep};

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
        let elapsed = self.last_request.elapsed();
        let sleep_time = self.cooldown.saturating_sub(elapsed);

        if !sleep_time.is_zero() {
            sleep(sleep_time).await;
        }

        self.last_request = Instant::now();
    }
}
