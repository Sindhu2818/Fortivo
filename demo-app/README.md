# demo-app

Deliberately vulnerable sample repo. Fortivo scans this during the demo.

Built in **Task 2**. It must contain, at minimum:

- a dependency manifest with pinned versions carrying known CVEs (so Trivy fires)
- a hardcoded credential or API key (so Trivy's secret scanner fires)
- an injection-style code flaw — SQL string concatenation, `eval`, unsafe
  deserialization (so Semgrep fires)
- a misconfigured Dockerfile or CI config (so Trivy's misconfig scanner fires)

The findings should be chainable into at least one plausible multi-step attack
path: public entry point → code execution → credential access.

This is throwaway demo input. Never run it.
