CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash
    ON api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
    ON api_keys(user_id);

CREATE INDEX IF NOT EXISTS idx_books_owner_id
    ON books(owner_id);

CREATE INDEX IF NOT EXISTS idx_books_metadata_id
    ON books(metadata_id);

CREATE INDEX IF NOT EXISTS idx_books_cover_id
    ON books(cover_id);

CREATE INDEX IF NOT EXISTS idx_books_state_id
    ON books(state_id);

CREATE INDEX IF NOT EXISTS idx_is_in_shelf_book_id
    ON is_in_shelf(book_id);

CREATE INDEX IF NOT EXISTS idx_change_log_owner_id_log_id
    ON change_log(owner_id, log_id);

CREATE INDEX IF NOT EXISTS idx_change_log_entity_id
    ON change_log(entity_id);
