-- no-transaction

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE metadata_new (
    metadata_id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL UNIQUE,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    publisher TEXT,
    publication_date DATETIME,
    isbn TEXT,
    page_count INTEGER,
    language TEXT,
    FOREIGN KEY(book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- Joining through `books` attaches each metadata row to its book, and drops any
-- row no book referenced -- rows older versions could leave behind.
INSERT INTO metadata_new (metadata_id, book_id, title, subtitle, description, publisher, publication_date, isbn, page_count, language)
    SELECT m.metadata_id, b.book_id, m.title, m.subtitle, m.description, m.publisher, m.publication_date, m.isbn, m.page_count, m.language
    FROM metadata m
    JOIN books b ON b.metadata_id = m.metadata_id;

DROP TABLE metadata;

ALTER TABLE metadata_new RENAME TO metadata;

-- Foreign keys are off, so dropping the old table did not cascade. Any child
-- rows belonging to metadata that was just discarded have to go explicitly, or
-- they would be left dangling.
DELETE FROM series WHERE metadata_id NOT IN (SELECT metadata_id FROM metadata);
DELETE FROM contributors WHERE metadata_id NOT IN (SELECT metadata_id FROM metadata);
DELETE FROM genres WHERE metadata_id NOT IN (SELECT metadata_id FROM metadata);

CREATE TABLE books_new (
    book_id TEXT NOT NULL PRIMARY KEY,
    owner_id TEXT NOT NULL,
    epub_id TEXT NOT NULL,
    cover_id TEXT,
    FOREIGN KEY(epub_id) REFERENCES epubs(epub_id) ON DELETE CASCADE,
    FOREIGN KEY(cover_id) REFERENCES covers(cover_id) ON DELETE SET NULL,
    FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(epub_id, owner_id)
);

INSERT INTO books_new (book_id, owner_id, epub_id, cover_id)
    SELECT book_id, owner_id, epub_id, cover_id FROM books;

DROP TABLE books;

ALTER TABLE books_new RENAME TO books;

-- idx_books_metadata_id is deliberately not recreated: the column is gone, and
-- metadata(book_id) is indexed by its own UNIQUE constraint.
CREATE INDEX IF NOT EXISTS idx_books_owner_id ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_cover_id ON books(cover_id);

COMMIT;

PRAGMA foreign_keys = ON;
