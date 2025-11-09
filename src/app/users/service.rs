use super::models::{ApiKey, Preferences, User, UserError};
use crate::app::{
    authentication::service::AuthenticationService,
    error::ProsaError,
    users::{
        models::{PreferencesError, UserProfile, VALID_PROVIDERS},
        repository::UserRepository,
    },
};
use merge::Merge;
use regex::Regex;
use std::sync::Arc;
use uuid::Uuid;

pub struct UserService {
    user_repository: Arc<UserRepository>,
}

impl UserService {
    pub fn new(user_repository: Arc<UserRepository>) -> Self {
        Self { user_repository }
    }

    pub async fn register_user(
        &self,
        username: &str,
        password: &str,
        is_admin: bool,
    ) -> Result<String, ProsaError> {
        Self::verify_username(username)?;
        Self::verify_password(password)?;

        let user_id = Uuid::new_v4().to_string();
        let password_hash = AuthenticationService::hash_secret(password);
        self.user_repository
            .add_user(username, &user_id, &password_hash, is_admin)
            .await?;
        self.user_repository
            .add_providers(&user_id, vec![VALID_PROVIDERS[0].to_string()])
            .await;

        Ok(user_id)
    }

    pub async fn login_user(&self, username: &str, password: &str) -> Result<User, UserError> {
        let user = self.user_repository.get_user_by_username(username).await?;
        if !AuthenticationService::verify_secret(&user.password_hash, password) {
            return Err(UserError::InvalidCredentials);
        }

        Ok(user)
    }

    pub async fn get_user(&self, user_id: &str) -> Result<User, ProsaError> {
        let user = self.user_repository.get_user(user_id).await?;
        Ok(user)
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<User, ProsaError> {
        let user = self.user_repository.get_user_by_username(username).await?;
        Ok(user)
    }

    pub async fn get_user_profile(&self, user_id: &str) -> Result<UserProfile, ProsaError> {
        let user = self.user_repository.get_user(user_id).await?;
        Ok(UserProfile {
            username: user.username,
        })
    }

    pub async fn update_user_profile(&self, user_id: &str, profile: UserProfile) -> Result<(), ProsaError> {
        Self::verify_username(&profile.username)?;
        self.user_repository.update_user_profile(user_id, profile).await?;
        Ok(())
    }

    pub async fn get_api_key_information(&self, user_id: &str, key_id: &str) -> Result<ApiKey, ProsaError> {
        self.user_repository.get_user(user_id).await?;
        let key = self
            .user_repository
            .get_api_key_information(user_id, key_id)
            .await?;
        Ok(key)
    }

    pub async fn list_api_keys(&self, user_id: &str) -> Result<Vec<String>, ProsaError> {
        self.user_repository.get_user(user_id).await?;
        let keys = self.user_repository.list_api_keys(user_id).await?;
        Ok(keys)
    }

    pub async fn get_preferences(&self, user_id: &str) -> Result<Preferences, ProsaError> {
        self.user_repository.get_user(user_id).await?;
        let preferences = self.user_repository.get_preferences(user_id).await?;
        Ok(preferences)
    }

    pub async fn update_preferences(
        &self,
        user_id: &str,
        preferences: Preferences,
    ) -> Result<(), ProsaError> {
        self.user_repository.get_user(user_id).await?;

        if preferences.automatic_metadata.is_none() {
            return Err(PreferencesError::MissingAutomaticMetadata.into());
        }

        if preferences.metadata_providers.is_none() {
            return Err(PreferencesError::InvalidMetadataProvider.into());
        }

        self.user_repository
            .update_preferences(user_id, preferences)
            .await?;
        Ok(())
    }

    pub async fn patch_preferences(
        &self,
        user_id: &str,
        mut preferences: Preferences,
    ) -> Result<(), ProsaError> {
        self.user_repository.get_user(user_id).await?;

        if preferences.automatic_metadata.is_none() && preferences.metadata_providers.is_none() {
            return Err(PreferencesError::InvalidPreferences.into());
        }

        let original = self.user_repository.get_preferences(user_id).await?;
        preferences.merge(original);

        if preferences.automatic_metadata.is_none() {
            return Err(PreferencesError::MissingAutomaticMetadata.into());
        }

        self.user_repository
            .update_preferences(user_id, preferences)
            .await?;
        Ok(())
    }

    fn verify_username(username: &str) -> Result<(), UserError> {
        let filter = Regex::new(r"^[\w.!@-]+$").unwrap();
        if !filter.is_match(username) {
            return Err(UserError::InvalidInput);
        }
        if username.len() > 20 {
            return Err(UserError::UsernameTooBig);
        }
        Ok(())
    }

    fn verify_password(password: &str) -> Result<(), UserError> {
        let filter = Regex::new(r"^[\w.!@#$%^&*-]+$").unwrap();
        if !filter.is_match(password) {
            return Err(UserError::InvalidInput);
        }
        if password.len() > 256 {
            return Err(UserError::PasswordTooBig);
        }
        Ok(())
    }
}
