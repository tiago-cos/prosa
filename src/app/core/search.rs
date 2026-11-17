pub fn contains_ignoring_case(term: &str) -> String {
    format!("(?i){}", regex::escape(term))
}
