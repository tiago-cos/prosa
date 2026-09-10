CREATE TABLE change_log_old (
    log_id INTEGER PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('book_file','book_metadata','book_cover','book_state','book_annotations','shelf_metadata','shelf_content')),
    owner_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('update','delete','create')),
    FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE
);

INSERT INTO change_log_old (log_id, entity_id, entity_type, owner_id, session_id, action)
    SELECT log_id, entity_id, entity_type, owner_id, session_id, action FROM change_log;

DROP TABLE change_log;

ALTER TABLE change_log_old RENAME TO change_log;

CREATE INDEX IF NOT EXISTS idx_change_log_owner_id_log_id
    ON change_log(owner_id, log_id);

CREATE INDEX IF NOT EXISTS idx_change_log_entity_id
    ON change_log(entity_id);
