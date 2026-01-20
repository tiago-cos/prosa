use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::users::{
        can_create_api_key, can_delete_api_key, can_read_api_key, can_read_api_keys, can_read_preferences,
        can_read_profile, can_update_preferences, can_update_profile,
    },
    users::controller::{
        create_api_key_handler, get_api_information_key_handler, get_preferences_handler,
        get_user_profile_handler, list_api_keys_handler, login_user_handler, logout_user_handler,
        patch_preferences_handler, refresh_token_handler, register_user_handler, revoke_api_key_handler,
        update_preferences_handler, update_user_profile_handler,
    },
};
use axum::{
    Router,
    middleware::from_fn,
    routing::{delete, get, patch, post, put},
};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/users/{user_id}/keys", post(create_api_key_handler)
            .route_layer(from_fn(can_create_api_key))
        )
        .route("/users/{user_id}/keys/{key_id}", get(get_api_information_key_handler) 
            .route_layer(from_fn(can_read_api_key))
        )
        .route("/users/{user_id}/keys", get(list_api_keys_handler) 
            .route_layer(from_fn(can_read_api_keys))
        )
        .route("/users/{user_id}/keys/{key_id}", delete(revoke_api_key_handler) 
            .route_layer(from_fn(can_delete_api_key))
        )
        .route("/users/{user_id}/preferences", put(update_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{user_id}/preferences", patch(patch_preferences_handler) 
            .route_layer(from_fn(can_update_preferences))
        )
        .route("/users/{user_id}/preferences", get(get_preferences_handler) 
            .route_layer(from_fn(can_read_preferences))
        )
        .route("/users/{user_id}", get(get_user_profile_handler) 
            .route_layer(from_fn(can_read_profile))
        )
        .route("/users/{user_id}", put(update_user_profile_handler) 
            .route_layer(from_fn(can_update_profile))
        )
        .layer(from_fn(extract_token_middleware))
        .route("/auth/register", post(register_user_handler))
        .route("/auth/login", post(login_user_handler))
        .route("/auth/logout", post(logout_user_handler))
        .route("/auth/refresh", post(refresh_token_handler))
}
