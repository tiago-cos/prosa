CREATE TABLE series_new (
    metadata_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    number REAL,
    FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE CASCADE
);

INSERT INTO series_new (metadata_id, title, number)
    SELECT metadata_id, title, number FROM series;

DROP TABLE series;

ALTER TABLE series_new RENAME TO series;
