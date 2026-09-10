-- no-transaction

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE state_new (
    book_id TEXT PRIMARY KEY NOT NULL,
    tag TEXT,
    source TEXT,
    rating REAL,
    reading_status TEXT NOT NULL CHECK(reading_status IN ('Unread','Reading','Read')),
    FOREIGN KEY(book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

INSERT INTO state_new (book_id, tag, source, rating, reading_status)
    SELECT b.book_id, s.tag, s.source, s.rating, s.reading_status
    FROM books b
    JOIN state s ON s.state_id = b.state_id;

DROP TABLE state;

ALTER TABLE state_new RENAME TO state;

CREATE TABLE books_new (
    book_id TEXT NOT NULL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    epub_id TEXT NOT NULL,
    metadata_id TEXT,
    cover_id TEXT,
    FOREIGN KEY(epub_id) REFERENCES epubs(epub_id) ON DELETE CASCADE,
    FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE SET NULL,
    FOREIGN KEY(cover_id) REFERENCES covers(cover_id) ON DELETE SET NULL,
    FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(epub_id, owner_id)
);

INSERT INTO books_new (book_id, owner_id, epub_id, metadata_id, cover_id)
    SELECT book_id, owner_id, epub_id, metadata_id, cover_id FROM books;

DROP TABLE books;

ALTER TABLE books_new RENAME TO books;

CREATE INDEX IF NOT EXISTS idx_books_owner_id ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_metadata_id ON books(metadata_id);
CREATE INDEX IF NOT EXISTS idx_books_cover_id ON books(cover_id);

COMMIT;

PRAGMA foreign_keys = ON;
