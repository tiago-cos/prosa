use super::models::{ApiKey, Preferences, User, UserError};
use crate::app::{
    authentication,
    core::ids,
    error::ProsaError,
    users::{
        models::{PROVIDERS, PreferencesError, UserProfile},
        repository,
    },
};
use crate::database::pool;
use log::warn;
use merge::Merge;
use regex::Regex;

pub async fn register_user(
    username: &str,
    password: &str,
    is_admin: bool,
    user_id: Option<String>,
) -> Result<String, ProsaError> {
    verify_username(username)?;
    verify_password(password)?;

    let user_id = ids::resolve(user_id).map_err(|_| UserError::InvalidUserId)?;

    if repository::user_exists(pool(), &user_id).await {
        return Err(UserError::UserIdConflict.into());
    }

    let password_hash = authentication::service::hash_secret(password);
    repository::add_user(pool(), username, &user_id, &password_hash, is_admin).await?;
    repository::add_providers(pool(), &user_id).await;

    Ok(user_id)
}

pub async fn login_user(username: &str, password: &str) -> Result<User, UserError> {
    let user = repository::get_user_by_username(pool(), username).await?;
    if !authentication::service::verify_secret(&user.password_hash, password) {
        return Err(UserError::InvalidCredentials);
    }

    Ok(user)
}

pub async fn get_user(user_id: &str) -> Result<User, ProsaError> {
    let user = repository::get_user(pool(), user_id).await?;
    Ok(user)
}

pub async fn get_user_by_username(username: &str) -> Result<User, ProsaError> {
    let user = repository::get_user_by_username(pool(), username).await?;
    Ok(user)
}

pub async fn get_user_profile(user_id: &str) -> Result<UserProfile, ProsaError> {
    let user = repository::get_user(pool(), user_id).await?;
    Ok(UserProfile {
        username: user.username,
    })
}

pub async fn update_user_profile(user_id: &str, profile: UserProfile) -> Result<(), ProsaError> {
    verify_username(&profile.username)?;
    repository::update_user_profile(pool(), user_id, profile).await?;
    Ok(())
}

pub async fn get_api_key_information(user_id: &str, key_id: &str) -> Result<ApiKey, ProsaError> {
    repository::get_user(pool(), user_id).await?;
    let key = repository::get_api_key_information(pool(), user_id, key_id).await?;
    Ok(key)
}

pub async fn list_api_keys(user_id: &str) -> Result<Vec<String>, ProsaError> {
    repository::get_user(pool(), user_id).await?;
    let keys = repository::list_api_keys(pool(), user_id).await?;
    Ok(keys)
}

pub async fn get_preferences(user_id: &str) -> Result<Preferences, ProsaError> {
    repository::get_user(pool(), user_id).await?;
    let preferences = repository::get_preferences(pool(), user_id).await?;
    Ok(preferences)
}

pub async fn get_provider_keys(
    user_id: &str,
    providers: &[String],
) -> Result<Vec<(String, Option<String>)>, ProsaError> {
    let stored = repository::get_provider_keys(pool(), user_id).await?;

    let keys = providers
        .iter()
        .map(|provider| {
            let key = stored
                .iter()
                .find(|(id, _)| id == provider)
                .and_then(|(_, key)| key.as_ref())
                .and_then(|sealed| {
                    authentication::service::decrypt_provider_api_key(sealed, user_id, provider).or_else(
                        || {
                            warn!("Stored key for provider {provider} could not be decrypted");
                            None
                        },
                    )
                });

            (provider.clone(), key)
        })
        .collect();

    Ok(keys)
}

pub async fn providers_are_usable(user_id: &str, providers: &[String]) -> Result<bool, ProsaError> {
    let configured = repository::get_configured_providers(pool(), user_id).await?;

    Ok(providers
        .iter()
        .filter(|p| requires_api_key(p))
        .all(|p| configured.contains(p)))
}

pub async fn update_preferences(user_id: &str, preferences: Preferences) -> Result<(), ProsaError> {
    repository::get_user(pool(), user_id).await?;

    if preferences.automatic_metadata.is_none() {
        return Err(PreferencesError::MissingAutomaticMetadata.into());
    }

    if preferences.metadata_providers.is_none() {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    store_preferences(user_id, preferences).await
}

pub async fn patch_preferences(user_id: &str, mut preferences: Preferences) -> Result<(), ProsaError> {
    repository::get_user(pool(), user_id).await?;

    if preferences.automatic_metadata.is_none()
        && preferences.metadata_providers.is_none()
        && preferences.provider_keys.is_none()
    {
        return Err(PreferencesError::InvalidPreferences.into());
    }

    let original = repository::get_preferences(pool(), user_id).await?;
    preferences.merge(original);

    if preferences.automatic_metadata.is_none() {
        return Err(PreferencesError::MissingAutomaticMetadata.into());
    }

    store_preferences(user_id, preferences).await
}

async fn store_preferences(user_id: &str, mut preferences: Preferences) -> Result<(), ProsaError> {
    let providers = preferences.metadata_providers.clone().unwrap_or_default();

    if !providers.iter().all(|p| is_valid_provider(p)) {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    if has_duplicate_providers(&providers) {
        return Err(PreferencesError::DuplicateMetadataProvider.into());
    }

    let submitted = preferences.provider_keys.take().unwrap_or_default();

    if !submitted.keys().all(|p| is_valid_provider(p)) {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    let configured = repository::get_configured_providers(pool(), user_id).await?;

    for provider in providers.iter().filter(|p| requires_api_key(p)) {
        let supplied = submitted.get(provider).is_some_and(Option::is_some);
        let stored = configured.contains(provider) && !submitted.contains_key(provider);

        if !supplied && !stored {
            return Err(PreferencesError::MissingProviderKey.into());
        }
    }

    let mut keys = Vec::with_capacity(submitted.len());
    for (provider, key) in submitted {
        let sealed = match key {
            Some(key) => Some(
                authentication::service::encrypt_provider_api_key(&key, user_id, &provider)
                    .ok_or(PreferencesError::InternalError)?,
            ),
            None => None,
        };
        keys.push((provider, sealed));
    }

    repository::update_preferences(pool(), user_id, preferences, keys).await?;
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

pub fn is_valid_provider(provider: &str) -> bool {
    PROVIDERS.iter().any(|(name, _)| *name == provider)
}

pub fn requires_api_key(provider: &str) -> bool {
    PROVIDERS
        .iter()
        .any(|(name, requires)| *name == provider && *requires)
}

pub fn has_duplicate_providers(providers: &[String]) -> bool {
    providers
        .iter()
        .enumerate()
        .any(|(index, provider)| providers[..index].contains(provider))
}
