/**
 * Scan page (/scan): repo URL input -> POST /scan -> poll status -> redirect to
 * /dashboard/<scan_id> when complete.
 *
 * Responsibility: submission and progress UI only. Owns the "scanning..." state
 * with per-stage labels. In DEMO_MODE, skips the network and routes straight to
 * the mock scan_id.
 *
 * DoD: submitting a repo lands on the dashboard for that scan_id.
 */
