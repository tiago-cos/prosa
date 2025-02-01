use super::handlers;
use crate::app::{authentication::{middleware::extract_token_middleware, models::AuthToken}, server::AppState};
use axum::{
    middleware::from_fn_with_state, routing::{get, post}, Extension, Router
};

pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/users", post(handlers::register_user_handler))
        .route("/users/{username}", post(handlers::login_user_handler))
        .route("/users/{username}/keys", post(handlers::create_api_key_handler))
        .route("/users/{username}/keys/{key_id}", get(handlers::get_api_key_handler))
        .route("/test", get(test)
            .route_layer(from_fn_with_state(state.clone(), extract_token_middleware))
        )
        .with_state(state)
}

//TODO remove
async fn test(Extension(token): Extension<AuthToken>) -> String {
    println!("{:#?}", token);
    "yay".to_string()
}