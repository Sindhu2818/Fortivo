/**
 * The only module that talks to the backend.
 *
 * Responsibility: wrap NEXT_PUBLIC_API_BASE with typed helpers —
 * startScan(repoUrl), getResult(scanId), listResults(). When
 * NEXT_PUBLIC_DEMO_MODE === 'true', every call short-circuits to lib/demo.ts
 * instead of hitting the network, so the UI demos with the backend stopped.
 *
 * DoD: with DEMO_MODE on and no backend running, getResult() resolves to the
 * mock ScanResult.
 */
