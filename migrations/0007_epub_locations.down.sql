CREATE TABLE annotations_old (
    annotation_id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    source TEXT NOT NULL,
    start_tag TEXT NOT NULL,
    end_tag TEXT NOT NULL,
    start_char INTEGER NOT NULL,
    end_char INTEGER NOT NULL,
    note TEXT,
    FOREIGN KEY(book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    UNIQUE (book_id, source, start_tag, end_tag, start_char, end_char)
);

DROP TABLE annotations;

ALTER TABLE annotations_old RENAME TO annotations;

CREATE TABLE state_old (
    book_id TEXT PRIMARY KEY NOT NULL,
    tag TEXT,
    source TEXT,
    rating REAL,
    reading_status TEXT NOT NULL CHECK(reading_status IN ('Unread','Reading','Read')),
    FOREIGN KEY(book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

INSERT INTO state_old (book_id, tag, source, rating, reading_status)
    SELECT book_id, NULL, NULL, rating, reading_status FROM state;

DROP TABLE state;

ALTER TABLE state_old RENAME TO state;
