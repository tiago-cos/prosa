use axum::{extract::Request, middleware::Next, response::Response};
use log::{error, info};
use tracing_subscriber::{
    fmt::{layer, time::ChronoUtc},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
};

pub fn init_logging() {
    let fmt_layer = layer()
        .with_target(false)
        .with_thread_ids(false)
        .with_thread_names(false)
        .with_file(false)
        .with_line_number(false)
        .with_timer(ChronoUtc::rfc_3339())
        .compact();

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry().with(filter).with(fmt_layer).init();
}

pub async fn log_layer(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    let response = next.run(req).await;

    let status = response.status();

    let colored_code = if status.is_success() || status.is_redirection() {
        format!("\x1B[32m{}\x1B[0m", status.as_u16())
    } else {
        format!("\x1B[31m{}\x1B[0m", status.as_u16())
    };

    if status.is_success() || status.is_redirection() {
        info!("{} {} [{}]", method, path, colored_code);
    } else {
        error!("{} {} [{}]", method, path, colored_code);
    };

    response
}
