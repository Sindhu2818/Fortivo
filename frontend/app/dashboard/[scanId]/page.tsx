/**
 * Dashboard (/dashboard/[scanId]): the main demo screen.
 *
 * Responsibility: load one ScanResult via lib/api, then compose RiskScore,
 * ScoreBreakdown, StatsBar, AttackGraph, FindingsTable and FindingDrawer.
 * Owns the selected-finding state that the table and graph both drive and the
 * drawer consumes. No fetching logic of its own beyond the one call.
 *
 * DoD: renders the risk score, the four components, up to 30 ranked findings,
 * and the attack graph for a given scan_id.
 */
