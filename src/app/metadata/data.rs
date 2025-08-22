use super::models::{Contributor, Metadata, MetadataError, Series};
use sqlx::{QueryBuilder, SqlitePool};

pub async fn get_metadata(pool: &SqlitePool, metadata_id: &str) -> Result<Metadata, MetadataError> {
    let mut metadata: Metadata = sqlx::query_as(
        r"
        SELECT title, subtitle, description, publisher, publication_date, isbn, page_count, language
        FROM metadata
        WHERE metadata_id = $1
        ",
    )
    .bind(metadata_id)
    .fetch_one(pool)
    .await?;

    let contributors: Vec<Contributor> = sqlx::query_as(
        r"
        SELECT role, name
        FROM contributors
        WHERE metadata_id = $1;
        ",
    )
    .bind(metadata_id)
    .fetch_all(pool)
    .await?;

    let contributors = Some(contributors).filter(|c| !c.is_empty());

    let series: Option<Series> = sqlx::query_as(
        r"
        SELECT title, number
        FROM series
        WHERE metadata_id = $1;
        ",
    )
    .bind(metadata_id)
    .fetch_optional(pool)
    .await?;

    let genres: Vec<String> = sqlx::query_scalar(
        r"
        SELECT genre
        FROM genres
        WHERE metadata_id = $1;
        ",
    )
    .bind(metadata_id)
    .fetch_all(pool)
    .await?;

    let genres = Some(genres).filter(|g| !g.is_empty());

    metadata.contributors = contributors;
    metadata.series = series;
    metadata.genres = genres;

    Ok(metadata)
}

pub async fn add_metadata(
    pool: &SqlitePool,
    metadata_id: &str,
    metadata: Metadata,
) -> Result<(), MetadataError> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        r"
        INSERT INTO metadata (metadata_id, title, subtitle, description, publisher, publication_date, isbn, page_count, language)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        ",
    )
    .bind(metadata_id)
    .bind(metadata.title)
    .bind(metadata.subtitle)
    .bind(metadata.description)
    .bind(metadata.publisher)
    .bind(metadata.publication_date)
    .bind(metadata.isbn)
    .bind(metadata.page_count)
    .bind(metadata.language)
    .execute(&mut *tx)
    .await?;

    if let Some(contributors) = metadata.contributors.filter(|c| !c.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO contributors (metadata_id, role, name)");

        query.push_values(contributors, |mut b, contributor| {
            b.push_bind(metadata_id)
                .push_bind(contributor.role)
                .push_bind(contributor.name);
        });

        query.build().execute(&mut *tx).await?;
    }

    if let Some(series) = metadata.series {
        sqlx::query(
            r"
            INSERT INTO series (metadata_id, title, number)
            VALUES ($1, $2, $3);
            ",
        )
        .bind(metadata_id)
        .bind(series.title)
        .bind(series.number)
        .execute(&mut *tx)
        .await?;
    }

    if let Some(genres) = metadata.genres.filter(|g| !g.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO genres (metadata_id, genre)");

        query.push_values(genres, |mut b, genre| {
            b.push_bind(metadata_id).push_bind(genre);
        });

        query.build().execute(&mut *tx).await?;
    }

    tx.commit().await?;

    Ok(())
}

pub async fn delete_metadata(pool: &SqlitePool, metadata_id: &str) -> Result<(), MetadataError> {
    let result = sqlx::query(
        r"
        DELETE FROM metadata
        WHERE metadata_id = $1;
        ",
    )
    .bind(metadata_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(MetadataError::MetadataNotFound);
    }

    Ok(())
}

pub async fn update_metadata(
    pool: &SqlitePool,
    metadata_id: &str,
    metadata: Metadata,
) -> Result<(), MetadataError> {
    let mut tx = pool.begin().await?;

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
        WHERE metadata_id = $1;
        ",
    )
    .bind(metadata_id)
    .bind(metadata.title)
    .bind(metadata.subtitle)
    .bind(metadata.description)
    .bind(metadata.publisher)
    .bind(metadata.publication_date)
    .bind(metadata.isbn)
    .bind(metadata.page_count)
    .bind(metadata.language)
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

    if let Some(contributors) = metadata.contributors.filter(|c| !c.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO contributors (metadata_id, role, name)");

        query.push_values(contributors, |mut b, contributor| {
            b.push_bind(metadata_id)
                .push_bind(contributor.role)
                .push_bind(contributor.name);
        });

        query.build().execute(&mut *tx).await?;
    }

    if let Some(series) = metadata.series {
        sqlx::query(
            r"
            INSERT INTO series (metadata_id, title, number)
            VALUES ($1, $2, $3);
            ",
        )
        .bind(metadata_id)
        .bind(series.title)
        .bind(series.number)
        .execute(&mut *tx)
        .await?;
    }

    if let Some(genres) = metadata.genres.filter(|g| !g.is_empty()) {
        let mut query = QueryBuilder::new("INSERT INTO genres (metadata_id, genre)");

        query.push_values(genres, |mut b, genre| {
            b.push_bind(metadata_id).push_bind(genre);
        });

        query.build().execute(&mut *tx).await?;
    }

    tx.commit().await?;

    Ok(())
}
