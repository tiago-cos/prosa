use super::{
    models::{
        CreateApiKeyRequest, CreateApiKeyResponse, GetApiKeyResponse, LoginUserRequest, Preferences,
        RegisterUserRequest, UserError,
    },
    service,
};
use crate::app::{
    authentication::service::AuthenticationService,
    error::ProsaError,
    users::models::{AuthenticationResponse, RefreshTokenRequest, UserProfile},
};
use axum::{
    Json,
    http::{HeaderMap, StatusCode},
};
use sqlx::SqlitePool;
use std::sync::Arc;

pub struct UserController {
    pool: SqlitePool,
    admin_key: String,
    allowed_registration: bool,
    authentication_service: Arc<AuthenticationService>,
}

impl UserController {
    pub fn new(
        pool: SqlitePool,
        admin_key: &str,
        allowed_registration: bool,
        authentication_service: Arc<AuthenticationService>,
    ) -> Self {
        Self {
            pool,
            admin_key: admin_key.to_owned(),
            allowed_registration,
            authentication_service,
        }
    }

    pub async fn register_user(
        &self,
        headers: HeaderMap,
        body: RegisterUserRequest,
    ) -> Result<Json<AuthenticationResponse>, ProsaError> {
        //TODO pass this allowed check into a authorization function
        match (self.allowed_registration, body.admin, headers.get("admin-key")) {
            (false, _, None) => return Err(UserError::RegistrationDisabled.into()),
            (_, _, Some(key)) if key == &self.admin_key => (),
            (_, false, None) => (),
            _ => return Err(UserError::InvalidCredentials.into()),
        }

        let user_id = service::register_user(&self.pool, &body.username, &body.password, body.admin).await?;

        let jwt_token = self.authentication_service.generate_jwt(&user_id, body.admin);

        let refresh_token = self.authentication_service.generate_refresh_token(&user_id).await;

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
        let user = service::login_user(&self.pool, &body.username, &body.password).await?;

        let jwt_token = self
            .authentication_service
            .generate_jwt(&user.user_id, user.is_admin);

        let refresh_token = self
            .authentication_service
            .generate_refresh_token(&user.user_id)
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
        let (refresh_token, encoded_refresh_token) = self
            .authentication_service
            .renew_refresh_token(&body.refresh_token)
            .await?;

        let user = service::get_user(&self.pool, &refresh_token.user_id).await?;

        let jwt_token = self
            .authentication_service
            .generate_jwt(&user.user_id, user.is_admin);

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
        let key = service::get_api_key_information(&self.pool, &user_id, &key_id).await?;
        let response = GetApiKeyResponse {
            name: key.name,
            capabilities: key.capabilities,
            expires_at: key.expiration.map(|date| date.timestamp_millis()),
        };

        Ok(Json(response))
    }

    pub async fn list_api_keys(&self, user_id: String) -> Result<Json<Vec<String>>, ProsaError> {
        let keys = service::list_api_keys(&self.pool, &user_id).await?;
        Ok(Json(keys))
    }

    pub async fn revoke_api_key(&self, user_id: String, key_id: String) -> Result<StatusCode, ProsaError> {
        self.authentication_service
            .revoke_api_key(&user_id, &key_id)
            .await?;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn get_preferences(&self, user_id: String) -> Result<Json<Preferences>, ProsaError> {
        let preferences = service::get_preferences(&self.pool, &user_id).await?;
        Ok(Json(preferences))
    }

    pub async fn update_preferences(
        &self,
        user_id: String,
        body: Preferences,
    ) -> Result<StatusCode, ProsaError> {
        service::update_preferences(&self.pool, &user_id, body).await?;
        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn patch_preferences(
        &self,
        user_id: String,
        body: Preferences,
    ) -> Result<StatusCode, ProsaError> {
        service::patch_preferences(&self.pool, &user_id, body).await?;
        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn get_user_profile(&self, user_id: String) -> Result<Json<UserProfile>, ProsaError> {
        let profile = service::get_user_profile(&self.pool, &user_id).await?;
        Ok(Json(profile))
    }

    pub async fn update_user_profile(
        &self,
        user_id: String,
        body: UserProfile,
    ) -> Result<StatusCode, ProsaError> {
        service::update_user_profile(&self.pool, &user_id, body).await?;
        Ok(StatusCode::NO_CONTENT)
    }
}
