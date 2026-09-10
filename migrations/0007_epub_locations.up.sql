CREATE TABLE annotations_new (
    annotation_id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY(book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    UNIQUE (book_id, start_location, end_location)
);

DROP TABLE annotations;

ALTER TABLE annotations_new RENAME TO annotations;

CREATE TABLE state_new (
    book_id TEXT PRIMARY KEY NOT NULL,
    location TEXT,
    rating REAL,
    reading_status TEXT NOT NULL CHECK(reading_status IN ('Unread','Reading','Read')),
    FOREIGN KEY(book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- Ratings and reading statuses carry over; the Kobo location does not.
INSERT INTO state_new (book_id, location, rating, reading_status)
    SELECT book_id, NULL, rating, reading_status FROM state;

DROP TABLE state;

ALTER TABLE state_new RENAME TO state;
