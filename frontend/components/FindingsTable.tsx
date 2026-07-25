/**
 * FindingsTable: the ranked list of up to 30 findings.
 *
 * Responsibility: render rank, severity badge, title, file_path:line, source and
 * occurrences. Supports filtering by severity and source. Clicking a row calls
 * onSelect(findingId) — it owns no drawer state itself.
 *
 * DoD: 30 rows render in rank order and a click surfaces the id to the parent.
 */
