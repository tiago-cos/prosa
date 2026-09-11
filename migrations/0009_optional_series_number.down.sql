CREATE TABLE series_old (
    metadata_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    number REAL NOT NULL,
    FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE CASCADE
);

INSERT INTO series_old (metadata_id, title, number)
    SELECT metadata_id, title, number FROM series WHERE number IS NOT NULL;

DROP TABLE series;

ALTER TABLE series_old RENAME TO series;
