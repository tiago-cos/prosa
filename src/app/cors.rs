use crate::config::Cors;
use axum::http::{HeaderName, HeaderValue, Method, header, uri::Authority};
use std::time::Duration;
use tower_http::cors::{AllowOrigin, CorsLayer};

const API_KEY: HeaderName = HeaderName::from_static("api-key");
const ADMIN_KEY: HeaderName = HeaderName::from_static("admin-key");

pub fn cors_layer(cors: &Cors) -> Result<Option<CorsLayer>, String> {
    let origins = match cors.allowed_origins.as_slice() {
        [] => return Ok(None),
        [any] if any == "*" => AllowOrigin::any(),
        origins => AllowOrigin::list(
            origins
                .iter()
                .map(|origin| normalized_origin(origin))
                .collect::<Result<Vec<_>, _>>()?,
        ),
    };

    let layer = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, API_KEY, ADMIN_KEY])
        .max_age(Duration::from_secs(cors.max_age_seconds));

    Ok(Some(layer))
}

fn normalized_origin(origin: &str) -> Result<HeaderValue, String> {
    let invalid = || {
        format!(
            "cors.allowed_origins: \"{origin}\" is not an origin; give scheme, host and optional port, \
             such as https://books.example.com, or \"*\" on its own"
        )
    };

    let origin = origin.to_ascii_lowercase();
    let valid = match origin.split_once("://") {
        Some(("http" | "https", authority)) => {
            !authority.contains(['/', '?', '#', '@']) && authority.parse::<Authority>().is_ok()
        }
        _ => false,
    };

    if !valid {
        return Err(invalid());
    }

    HeaderValue::from_str(&origin).map_err(|_| invalid())
}
