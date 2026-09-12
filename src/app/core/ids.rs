use uuid::Uuid;

pub struct InvalidId;

pub fn resolve(supplied: Option<String>) -> Result<String, InvalidId> {
    supplied.map_or_else(
        || Ok(Uuid::new_v4().to_string()),
        |id| {
            Uuid::parse_str(&id)
                .map(|id| id.to_string())
                .map_err(|_| InvalidId)
        },
    )
}
