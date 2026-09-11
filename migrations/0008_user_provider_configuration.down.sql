CREATE TABLE providers_old (
    provider_type TEXT NOT NULL CHECK(provider_type IN ('goodreads_metadata_scraper','epub_metadata_extractor')),
    priority INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, provider_type)
);

INSERT INTO providers_old (provider_type, priority, user_id)
    SELECT provider_id, priority, user_id
    FROM user_providers
    WHERE enabled = TRUE AND provider_id = 'epub_metadata_extractor';

DROP TABLE user_providers;
DROP TABLE providers;

ALTER TABLE providers_old RENAME TO providers;
