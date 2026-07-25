/**
 * DEMO_MODE data source: serves fixtures/mock_results.json as a typed
 * ScanResult, with a small artificial delay so loading states are visible.
 *
 * Responsibility: keep every mock in one file. No component imports the fixture
 * directly.
 *
 * DoD: the exported mock type-checks as ScanResult with no casts.
 */
