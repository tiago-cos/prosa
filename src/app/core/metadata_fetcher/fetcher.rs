use crate::app::{
    core::metadata_fetcher::providers::{epub_extractor, remote::RemoteProvider},
    metadata::models::Metadata,
    users::models::DEFAULT_PROVIDER,
};
use book_metadata::MetadataQuery;
use log::warn;
use merge::Merge;

pub struct MetadataFetcher {
    remote: Vec<RemoteProvider>,
}

impl MetadataFetcher {
    pub fn new() -> Self {
        Self {
            remote: RemoteProvider::all(),
        }
    }

    pub async fn fetch_metadata(
        &self,
        epub_data: &[u8],
        providers: &[(String, Option<String>)],
    ) -> (Option<Metadata>, Option<Vec<u8>>) {
        let (local, local_cover) = epub_extractor::extract(epub_data);

        let query = local.as_ref().and_then(identify);
        if query.is_none() && providers.iter().any(|(id, _)| id != DEFAULT_PROVIDER) {
            warn!("The book carries no ISBN, title or author, so no catalogue can be searched");
        }

        let mut metadata = Metadata::default();
        let mut covers: Vec<Vec<u8>> = Vec::new();

        for (provider_id, api_key) in providers {
            if metadata.is_complete() {
                break;
            }

            if provider_id == DEFAULT_PROVIDER {
                if let Some(local) = local.clone() {
                    metadata.merge(local);
                }
                covers.extend(local_cover.clone());
                continue;
            }

            let Some(query) = query.as_ref() else { continue };
            let Some(provider) = self.remote.iter().find(|p| p.provider_id() == provider_id) else {
                continue;
            };

            let Some(found) = provider.fetch(query, api_key.as_deref()).await else {
                continue;
            };

            let image_url = found.image_url.clone();
            metadata.merge(found.into());

            if let Some(url) = image_url
                && let Some(cover) = download_cover(&url).await
            {
                covers.push(cover);
            }
        }

        let cover = covers.into_iter().max_by_key(Vec::len);
        let metadata = (!metadata.is_empty()).then_some(metadata);

        (metadata, cover)
    }
}

fn identify(local: &Metadata) -> Option<MetadataQuery> {
    if let Some(isbn) = local.isbn.as_ref() {
        let query = MetadataQuery::isbn(isbn);
        if query.validate().is_ok() {
            return Some(query);
        }
    }

    let title = local.title.as_ref()?;
    let author = local
        .contributors
        .as_ref()
        .and_then(|c| c.iter().find(|c| c.role == "Author"));

    let query = author.map_or_else(
        || MetadataQuery::title(title),
        |author| MetadataQuery::title(title).with_author(&author.name),
    );

    query.validate().is_ok().then_some(query)
}

async fn download_cover(url: &str) -> Option<Vec<u8>> {
    let response = reqwest::get(url)
        .await
        .inspect_err(|e| warn!("Failed to download a cover: {e}"))
        .ok()?;

    let bytes = response
        .bytes()
        .await
        .inspect_err(|e| warn!("Failed to read a downloaded cover: {e}"))
        .ok()?;

    (!bytes.is_empty()).then(|| bytes.to_vec())
}
