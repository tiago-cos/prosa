use super::models::{
    CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse, LoginUserRequest, Preferences,
    RegisterUserRequest,
};
use crate::app::{
    authentication::service::AuthenticationService,
    error::ProsaError,
    users::{
        models::{AuthenticationResponse, RefreshTokenRequest, UserProfile},
        service::UserService,
    },
};
use axum::{
    Json,
    http::{HeaderMap, StatusCode},
};
use std::sync::Arc;

pub struct UserController {
    authentication_service: Arc<AuthenticationService>,
    user_service: Arc<UserService>,
}

impl UserController {
    pub fn new(authentication_service: Arc<AuthenticationService>, user_service: Arc<UserService>) -> Self {
        Self {
            authentication_service,
            user_service,
        }
    }

    pub async fn register_user(
        &self,
        headers: HeaderMap,
        body: RegisterUserRequest,
    ) -> Result<Json<AuthenticationResponse>, ProsaError> {
        let admin_key = headers.get("admin-key").and_then(|h| h.to_str().ok());
        self.authentication_service.can_register(body.admin, admin_key)?;

        let user_id = self
            .user_service
            .register_user(&body.username, &body.password, body.admin)
            .await?;

        let session_id = AuthenticationService::generate_new_session();
        let jwt_token = self
            .authentication_service
            .generate_jwt(&user_id, &session_id, body.admin);
        let refresh_token = self
            .authentication_service
            .generate_refresh_token(&user_id, &session_id)
            .await;

        let response = AuthenticationResponse {
            jwt_token,
            refresh_token,
            user_id,
        };

        Ok(Json(response))
    }

    pub async fn login_user(
        &self,
        body: LoginUserRequest,
    ) -> Result<Json<AuthenticationResponse>, ProsaError> {
        let user = self
            .user_service
            .login_user(&body.username, &body.password)
            .await?;

        let session_id = AuthenticationService::generate_new_session();

        let jwt_token = self
            .authentication_service
            .generate_jwt(&user.user_id, &session_id, user.is_admin);

        let refresh_token = self
            .authentication_service
            .generate_refresh_token(&user.user_id, &session_id)
            .await;

        let response = AuthenticationResponse {
            jwt_token,
            refresh_token,
            user_id: user.user_id,
        };

        Ok(Json(response))
    }

    pub async fn logout_user(&self, body: RefreshTokenRequest) -> Result<StatusCode, ProsaError> {
        self.authentication_service
            .invalidate_refresh_token(&body.refresh_token)
            .await?;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn refresh_token(
        &self,
        body: RefreshTokenRequest,
    ) -> Result<Json<AuthenticationResponse>, ProsaError> {
        let (token, encoded_refresh_token) = self
            .authentication_service
            .renew_refresh_token(&body.refresh_token)
            .await?;

        let user = self.user_service.get_user(&token.user_id).await?;

        let jwt_token =
            self.authentication_service
                .generate_jwt(&user.user_id, &token.session_id, user.is_admin);

        let response = AuthenticationResponse {
            jwt_token,
            refresh_token: encoded_refresh_token,
            user_id: user.user_id,
        };

        Ok(Json(response))
    }

    pub async fn create_api_key(
        &self,
        user_id: String,
        body: CreateApiKeyRequest,
    ) -> Result<Json<CreateApiKeyResponse>, ProsaError> {
        let (key_id, key) = self
            .authentication_service
            .generate_api_key(&user_id, &body.name, body.expires_at, body.capabilities)
            .await?;

        Ok(Json(CreateApiKeyResponse { id: key_id, key }))
    }

    pub async fn get_api_information_key(
        &self,
        user_id: String,
        key_id: String,
    ) -> Result<Json<GetApiKeyResponse>, ProsaError> {
        let key = self
            .user_service
            .get_api_key_information(&user_id, &key_id)
            .await?;
        let response = GetApiKeyResponse {
            name: key.name,
            capabilities: key.capabilities,
            expires_at: key.expiration.map(|date| date.timestamp_millis()),
        };

        Ok(Json(response))
    }

    pub async fn list_api_keys(&self, user_id: String) -> Result<Json<Vec<String>>, ProsaError> {
        let keys = self.user_service.list_api_keys(&user_id).await?;
        Ok(Json(keys))
    }

    pub async fn revoke_api_key(&self, user_id: String, key_id: String) -> Result<StatusCode, ProsaError> {
        self.authentication_service
            .revoke_api_key(&user_id, &key_id)
            .await?;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn get_preferences(&self, user_id: String) -> Result<Json<Preferences>, ProsaError> {
        let preferences = self.user_service.get_preferences(&user_id).await?;
        Ok(Json(preferences))
    }

    pub async fn update_preferences(
        &self,
        user_id: String,
        body: Preferences,
    ) -> Result<StatusCode, ProsaError> {
        self.user_service.update_preferences(&user_id, body).await?;
        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn patch_preferences(
        &self,
        user_id: String,
        body: Preferences,
    ) -> Result<StatusCode, ProsaError> {
        self.user_service.patch_preferences(&user_id, body).await?;
        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn get_user_profile(&self, user_id: String) -> Result<Json<UserProfile>, ProsaError> {
        let profile = self.user_service.get_user_profile(&user_id).await?;
        Ok(Json(profile))
    }

    pub async fn update_user_profile(
        &self,
        user_id: String,
        body: UserProfile,
    ) -> Result<StatusCode, ProsaError> {
        self.user_service.update_user_profile(&user_id, body).await?;
        Ok(StatusCode::NO_CONTENT)
    }
}
