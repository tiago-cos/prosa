-- no-transaction

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE state_old (
    state_id TEXT PRIMARY KEY NOT NULL,
    tag TEXT,
    source TEXT,
    rating REAL,
    reading_status TEXT NOT NULL CHECK(reading_status IN ('Unread','Reading','Read'))
);

INSERT INTO state_old (state_id, tag, source, rating, reading_status)
    SELECT book_id, tag, source, rating, reading_status FROM state;

CREATE TABLE books_old (
    book_id TEXT NOT NULL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    epub_id TEXT NOT NULL,
    metadata_id TEXT,
    cover_id TEXT,
    state_id TEXT NOT NULL,
    FOREIGN KEY(epub_id) REFERENCES epubs(epub_id) ON DELETE CASCADE,
    FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE SET NULL,
    FOREIGN KEY(cover_id) REFERENCES covers(cover_id) ON DELETE SET NULL,
    FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY(state_id) REFERENCES state(state_id) ON DELETE CASCADE,
    UNIQUE(epub_id, owner_id)
);

INSERT INTO books_old (book_id, owner_id, epub_id, metadata_id, cover_id, state_id)
    SELECT book_id, owner_id, epub_id, metadata_id, cover_id, book_id FROM books;

DROP TABLE state;
DROP TABLE books;

ALTER TABLE state_old RENAME TO state;
ALTER TABLE books_old RENAME TO books;

CREATE INDEX IF NOT EXISTS idx_books_owner_id ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_metadata_id ON books(metadata_id);
CREATE INDEX IF NOT EXISTS idx_books_cover_id ON books(cover_id);
CREATE INDEX IF NOT EXISTS idx_books_state_id ON books(state_id);

COMMIT;

PRAGMA foreign_keys = ON;
