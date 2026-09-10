use super::models::{Contributor, Metadata, MetadataError, Series};
use sqlx::{Acquire, QueryBuilder, Sqlite};

pub async fn get_metadata<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    book_id: &str,
) -> Result<Metadata, MetadataError> {
    let mut conn = db.acquire().await?;

    let mut metadata: Metadata = sqlx::query_as(
        r"
        SELECT title, subtitle, description, publisher, publication_date, isbn, page_count, language
        FROM metadata
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_one(&mut *conn)
    .await?;

    let contributors: Vec<Contributor> = sqlx::query_as(
        r"
        SELECT c.role, c.name
        FROM contributors c
        JOIN metadata m ON m.metadata_id = c.metadata_id
        WHERE m.book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_all(&mut *conn)
    .await?;

    let contributors = Some(contributors).filter(|c| !c.is_empty());

    let series: Option<Series> = sqlx::query_as(
        r"
        SELECT s.title, s.number
        FROM series s
        JOIN metadata m ON m.metadata_id = s.metadata_id
        WHERE m.book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_optional(&mut *conn)
    .await?;

    let genres: Vec<String> = sqlx::query_scalar(
        r"
        SELECT g.genre
        FROM genres g
        JOIN metadata m ON m.metadata_id = g.metadata_id
        WHERE m.book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_all(&mut *conn)
    .await?;

    let genres = Some(genres).filter(|g| !g.is_empty());

    metadata.contributors = contributors;
    metadata.series = series;
    metadata.genres = genres;

    Ok(metadata)
}

pub async fn metadata_exists<'e>(db: impl sqlx::SqliteExecutor<'e>, book_id: &str) -> bool {
    sqlx::query_scalar::<_, i64>(
        r"
        SELECT 1
        FROM metadata
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_optional(db)
    .await
    .expect("Failed to check for book metadata")
    .is_some()
}

pub async fn add_metadata<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    metadata_id: &str,
    book_id: &str,
    metadata: &Metadata,
) -> Result<(), MetadataError> {
    let mut tx = db.begin().await?;

    sqlx::query(
        r"
        INSERT INTO metadata (metadata_id, book_id, title, subtitle, description, publisher, publication_date, isbn, page_count, language)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ",
    )
    .bind(metadata_id)
    .bind(book_id)
    .bind(&metadata.title)
    .bind(&metadata.subtitle)
    .bind(&metadata.description)
    .bind(&metadata.publisher)
    .bind(metadata.publication_date)
    .bind(&metadata.isbn)
    .bind(metadata.page_count)
    .bind(&metadata.language)
    .execute(&mut *tx)
    .await?;

    if let Some(contributors) = metadata.contributors.as_ref().filter(|c| !c.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO contributors (metadata_id, role, name)");
        query.push_values(contributors, |mut b, contributor| {
            b.push_bind(metadata_id)
                .push_bind(&contributor.role)
                .push_bind(&contributor.name);
        });
        query.build().execute(&mut *tx).await?;
    }

    if let Some(series) = &metadata.series {
        sqlx::query(
            r"
            INSERT INTO series (metadata_id, title, number)
            VALUES ($1, $2, $3)
            ",
        )
        .bind(metadata_id)
        .bind(&series.title)
        .bind(series.number)
        .execute(&mut *tx)
        .await?;
    }

    if let Some(genres) = metadata.genres.as_ref().filter(|g| !g.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO genres (metadata_id, genre)");
        query.push_values(genres, |mut b, genre| {
            b.push_bind(metadata_id).push_bind(genre);
        });
        query.build().execute(&mut *tx).await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn delete_metadata<'e>(
    db: impl sqlx::SqliteExecutor<'e>,
    book_id: &str,
) -> Result<(), MetadataError> {
    let result = sqlx::query(
        r"
        DELETE FROM metadata
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(MetadataError::MetadataNotFound);
    }

    Ok(())
}

pub async fn update_metadata<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    book_id: &str,
    metadata: &Metadata,
) -> Result<(), MetadataError> {
    let mut tx = db.begin().await?;

    let metadata_id: Option<String> = sqlx::query_scalar(
        r"
        SELECT metadata_id
        FROM metadata
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(metadata_id) = metadata_id else {
        return Err(MetadataError::MetadataNotFound);
    };
    let metadata_id = metadata_id.as_str();

    let result = sqlx::query(
        r"
        UPDATE metadata SET
            title = $2,
            subtitle = $3,
            description = $4,
            publisher = $5,
            publication_date = $6,
            isbn = $7,
            page_count = $8,
            language = $9
        WHERE metadata_id = $1
        ",
    )
    .bind(metadata_id)
    .bind(&metadata.title)
    .bind(&metadata.subtitle)
    .bind(&metadata.description)
    .bind(&metadata.publisher)
    .bind(metadata.publication_date)
    .bind(&metadata.isbn)
    .bind(metadata.page_count)
    .bind(&metadata.language)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(MetadataError::MetadataNotFound);
    }

    sqlx::query("DELETE FROM contributors WHERE metadata_id = ?")
        .bind(metadata_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM series WHERE metadata_id = ?")
        .bind(metadata_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM genres WHERE metadata_id = ?")
        .bind(metadata_id)
        .execute(&mut *tx)
        .await?;

    if let Some(contributors) = metadata.contributors.as_ref().filter(|c| !c.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO contributors (metadata_id, role, name)");
        query.push_values(contributors, |mut b, contributor| {
            b.push_bind(metadata_id)
                .push_bind(&contributor.role)
                .push_bind(&contributor.name);
        });
        query.build().execute(&mut *tx).await?;
    }

    if let Some(series) = &metadata.series {
        sqlx::query(
            r"
            INSERT INTO series (metadata_id, title, number)
            VALUES ($1, $2, $3)
            ",
        )
        .bind(metadata_id)
        .bind(&series.title)
        .bind(series.number)
        .execute(&mut *tx)
        .await?;
    }

    if let Some(genres) = metadata.genres.as_ref().filter(|g| !g.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO genres (metadata_id, genre)");
        query.push_values(genres, |mut b, genre| {
            b.push_bind(metadata_id).push_bind(genre);
        });
        query.build().execute(&mut *tx).await?;
    }

    tx.commit().await?;
    Ok(())
}
