# CONTRACT.md — FROZEN

This file is the single source of truth for the shape of `results/<scan_id>.json`,
every API response body, and every TypeScript interface in the frontend.

**This file is frozen. Code conforms to it. Never edit it.**

## Canonical example

```json
{
  "scan_id": "scan_20260725_142301",
  "repo_url": "https://github.com/example/vulnerable-app",
  "repo_name": "vulnerable-app",
  "scanned_at": "2026-07-25T14:23:01Z",
  "duration_seconds": 41.7,
  "status": "complete",
  "risk": {
    "score": 78,
    "band": "high",
    "components": {
      "severity": 82,
      "exploitability": 71,
      "exposure": 88,
      "blast_radius": 64
    },
    "summary": "Three internet-reachable services run dependencies with known remote code execution CVEs, and a hardcoded database credential sits in the same service."
  },
  "stats": {
    "raw_findings": 412,
    "after_dedup": 260,
    "reported_findings": 30,
    "by_severity": {
      "critical": 4,
      "high": 9,
      "medium": 12,
      "low": 5,
      "info": 0
    },
    "by_source": {
      "trivy": 21,
      "semgrep": 9
    }
  },
  "findings": [
    {
      "id": "f_001",
      "rank": 1,
      "source": "trivy",
      "rule_id": "CVE-2024-21538",
      "title": "Regular expression denial of service in cross-spawn",
      "severity": "critical",
      "cvss": 9.8,
      "category": "dependency",
      "file_path": "services/api/package-lock.json",
      "line_start": 1420,
      "line_end": 1420,
      "package": {
        "name": "cross-spawn",
        "installed_version": "7.0.3",
        "fixed_version": "7.0.5"
      },
      "code_snippet": "\"cross-spawn\": \"^7.0.3\"",
      "cwe": ["CWE-1333"],
      "references": ["https://nvd.nist.gov/vuln/detail/CVE-2024-21538"],
      "occurrences": 3,
      "duplicate_of": null,
      "score_contribution": 12.4,
      "explanation": {
        "what": "cross-spawn builds a regular expression from user-controllable input, so a crafted argument can hang the event loop.",
        "why_it_matters": "The API service parses request bodies through this path, so a single unauthenticated request can stall the process.",
        "fix": "Bump cross-spawn to 7.0.5 in services/api and regenerate the lockfile.",
        "confidence": "high"
      }
    }
  ],
  "attack_paths": [
    {
      "id": "ap_001",
      "title": "Unauthenticated RCE to database credential theft",
      "severity": "critical",
      "likelihood": "likely",
      "narrative": "An attacker reaches the public API, triggers the deserialization flaw to run code in the container, then reads the hardcoded database password from the same service and pivots to the primary database.",
      "steps": [
        {
          "order": 1,
          "finding_id": "f_003",
          "label": "Public API endpoint accepts untrusted input",
          "technique": "Initial access"
        },
        {
          "order": 2,
          "finding_id": "f_001",
          "label": "Deserialization gives code execution",
          "technique": "Execution"
        },
        {
          "order": 3,
          "finding_id": "f_007",
          "label": "Hardcoded DB credential read from disk",
          "technique": "Credential access"
        }
      ],
      "edges": [
        { "from": "f_003", "to": "f_001" },
        { "from": "f_001", "to": "f_007" }
      ]
    }
  ],
  "errors": []
}
```

## Field reference

### Root

| Field | Type | Notes |
|---|---|---|
| `scan_id` | string | `scan_<YYYYMMDD>_<HHMMSS>`. Unique, also the results filename. |
| `repo_url` | string | Git URL or local path as submitted. |
| `repo_name` | string | Last path segment of `repo_url`. |
| `scanned_at` | string | ISO-8601 UTC, `Z` suffix. |
| `duration_seconds` | number | Wall-clock seconds for the whole pipeline. |
| `status` | string enum | `queued` \| `running` \| `complete` \| `failed` |
| `risk` | object | See **Risk**. |
| `stats` | object | See **Stats**. |
| `findings` | array | 0–30 **Finding** objects, sorted by `rank` ascending. |
| `attack_paths` | array | 0–5 **AttackPath** objects. |
| `errors` | string[] | Human-readable non-fatal failures (e.g. `"semgrep exited 1"`). Empty when clean. |

### Risk

| Field | Type | Notes |
|---|---|---|
| `score` | integer | 0–100 inclusive. |
| `band` | string enum | `low` (0–24) \| `medium` (25–49) \| `high` (50–74) \| `critical` (75–100) |
| `components.severity` | integer | 0–100. How bad the worst findings are. |
| `components.exploitability` | integer | 0–100. Public exploit / low attack complexity. |
| `components.exposure` | integer | 0–100. Reachable from outside vs. internal only. |
| `components.blast_radius` | integer | 0–100. How much is reachable after compromise. |
| `summary` | string | 1–3 sentences, LLM-written. Never contains a number the scorer did not produce. |

### Stats

| Field | Type | Notes |
|---|---|---|
| `raw_findings` | integer | Total findings emitted by all scanners before any processing. |
| `after_dedup` | integer | Count after dedup, before ranking cutoff. |
| `reported_findings` | integer | `len(findings)`. Never greater than 30. |
| `by_severity` | object | Integer counts keyed by `critical`, `high`, `medium`, `low`, `info`. All five keys always present. |
| `by_source` | object | Integer counts keyed by scanner name (`trivy`, `semgrep`). |

### Finding

| Field | Type | Notes |
|---|---|---|
| `id` | string | `f_<3-digit>`, unique within a scan. |
| `rank` | integer | 1-based, 1 = most important. Dense, no gaps. |
| `source` | string enum | `trivy` \| `semgrep` |
| `rule_id` | string | CVE id for Trivy, rule id for Semgrep. |
| `title` | string | One line, no trailing period. |
| `severity` | string enum | `critical` \| `high` \| `medium` \| `low` \| `info` |
| `cvss` | number \| null | 0.0–10.0. `null` when the scanner gave none. |
| `category` | string enum | `dependency` \| `secret` \| `code` \| `config` \| `license` |
| `file_path` | string | Repo-relative POSIX path. Never absolute. |
| `line_start` | integer \| null | 1-based. `null` when not line-scoped. |
| `line_end` | integer \| null | 1-based, `>= line_start`. `null` when not line-scoped. |
| `package` | object \| null | Only for `category: "dependency"`. `{name, installed_version, fixed_version}`; `fixed_version` may be `null` when no fix exists. |
| `code_snippet` | string \| null | Max 400 chars, verbatim from the repo. |
| `cwe` | string[] | e.g. `["CWE-89"]`. May be empty. |
| `references` | string[] | URLs. May be empty. |
| `occurrences` | integer | `>= 1`. How many raw findings collapsed into this one. |
| `duplicate_of` | string \| null | Always `null` in output — reserved for debugging dedup. |
| `score_contribution` | number | Points this finding added to `risk.score`. |
| `explanation` | object \| null | LLM-written. `null` until the reasoning stage runs. |
| `explanation.what` | string | Plain-language description of the flaw. |
| `explanation.why_it_matters` | string | Impact in this repo's context. |
| `explanation.fix` | string | Concrete remediation step. |
| `explanation.confidence` | string enum | `high` \| `medium` \| `low` |

### AttackPath

| Field | Type | Notes |
|---|---|---|
| `id` | string | `ap_<3-digit>`. |
| `title` | string | One line. |
| `severity` | string enum | Same five values as Finding severity. |
| `likelihood` | string enum | `likely` \| `possible` \| `unlikely` |
| `narrative` | string | LLM-written, 2–4 sentences, past-to-future attacker story. |
| `steps` | array | 2–5 **Step** objects, `order` ascending from 1. |
| `steps[].order` | integer | 1-based, dense. |
| `steps[].finding_id` | string | Must match a `findings[].id` in the same document. |
| `steps[].label` | string | Short node label for the graph. |
| `steps[].technique` | string | Free text, MITRE-ATT&CK-flavoured tactic name. |
| `edges` | array | `{from, to}` pairs of `finding_id`s. Directed, acyclic. |

## Invariants

1. `findings` is never longer than 30.
2. Every `attack_paths[].steps[].finding_id` and every `edges[].from`/`edges[].to`
   resolves to a `findings[].id` in the same document.
3. `stats.reported_findings == len(findings)`.
4. `risk.band` is derived from `risk.score` using the bands above — never set independently.
5. The LLM writes only `risk.summary`, `findings[].explanation`, and
   `attack_paths[].narrative`/`title`. Every number is computed in Python.
