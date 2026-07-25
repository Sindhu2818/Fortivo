/**
 * FindingDrawer: shadcn Sheet showing one finding in full.
 *
 * Responsibility: render code_snippet, package versions (installed -> fixed),
 * cvss, cwe, references, score_contribution, and the LLM explanation
 * (what / why_it_matters / fix / confidence). Handles explanation === null with
 * a quiet fallback rather than a blank panel.
 *
 * DoD: opens for any finding and shows explanation text when present.
 */
