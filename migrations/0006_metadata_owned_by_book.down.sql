-- no-transaction

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE books_old (
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

INSERT INTO books_old (book_id, owner_id, epub_id, metadata_id, cover_id)
    SELECT b.book_id, b.owner_id, b.epub_id, m.metadata_id, b.cover_id
    FROM books b
    LEFT JOIN metadata m ON m.book_id = b.book_id;

CREATE TABLE metadata_old (
    metadata_id TEXT PRIMARY KEY NOT NULL,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    publisher TEXT,
    publication_date DATETIME,
    isbn TEXT,
    page_count INTEGER,
    language TEXT
);

INSERT INTO metadata_old (metadata_id, title, subtitle, description, publisher, publication_date, isbn, page_count, language)
    SELECT metadata_id, title, subtitle, description, publisher, publication_date, isbn, page_count, language
    FROM metadata;

DROP TABLE books;
DROP TABLE metadata;

ALTER TABLE books_old RENAME TO books;
ALTER TABLE metadata_old RENAME TO metadata;

CREATE INDEX IF NOT EXISTS idx_books_owner_id ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_metadata_id ON books(metadata_id);
CREATE INDEX IF NOT EXISTS idx_books_cover_id ON books(cover_id);

COMMIT;

PRAGMA foreign_keys = ON;
