CREATE TABLE providers_new (
    user_id TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK(provider_type IN ('goodreads_metadata_scraper','epub_metadata_extractor')),
    priority INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, provider_type)
);

INSERT INTO providers_new (user_id, provider_type, priority)
    SELECT user_id, provider_type, priority FROM providers;

DROP TABLE providers;

ALTER TABLE providers_new RENAME TO providers;
