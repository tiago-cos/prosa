ALTER TABLE providers RENAME TO user_providers_old;

CREATE TABLE providers (
    provider_id      TEXT PRIMARY KEY NOT NULL,
    requires_api_key BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO providers (provider_id, requires_api_key) VALUES
    ('epub_metadata_extractor', FALSE),
    ('openlibrary',             FALSE),
    ('hardcover',               TRUE),
    ('google_books',            TRUE);

CREATE TABLE user_providers (
    user_id     TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    priority    INTEGER NOT NULL,
    api_key     TEXT,
    PRIMARY KEY (user_id, provider_id),
    FOREIGN KEY (user_id)     REFERENCES users(user_id)         ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(provider_id) ON DELETE CASCADE
);

INSERT INTO user_providers (user_id, provider_id, enabled, priority, api_key)
    SELECT o.user_id, o.provider_type, TRUE, o.priority, NULL
    FROM user_providers_old o
    JOIN providers p ON p.provider_id = o.provider_type;

INSERT INTO user_providers (user_id, provider_id, enabled, priority, api_key)
    SELECT missing.user_id, missing.provider_id, FALSE,
           COALESCE(
               (SELECT MAX(o.priority) FROM user_providers_old o WHERE o.user_id = missing.user_id),
               0
           ) + ROW_NUMBER() OVER (PARTITION BY missing.user_id ORDER BY missing.provider_id),
           NULL
    FROM (
        SELECT u.user_id AS user_id, p.provider_id AS provider_id
        FROM users u
        CROSS JOIN providers p
        WHERE NOT EXISTS (
            SELECT 1 FROM user_providers up
            WHERE up.user_id = u.user_id AND up.provider_id = p.provider_id
        )
    ) AS missing;

DROP TABLE user_providers_old;

CREATE INDEX IF NOT EXISTS idx_user_providers_user_id_priority
    ON user_providers(user_id, priority);
