"""Map raw Trivy and Semgrep JSON into the common models.Finding shape.

Responsibility
--------------
The single translation layer between scanner-specific vocabulary and CONTRACT.md.
Owns:
  * severity mapping (Trivy CRITICAL/HIGH/... and Semgrep ERROR/WARNING/INFO -> our
    five-value Severity enum)
  * category assignment (dependency / secret / code / config / license)
  * absolute -> repo-relative POSIX file paths
  * code_snippet extraction, truncated to 400 chars
  * cvss, cwe, references extraction where the scanner provides them

Findings come out unranked and unnumbered: rank, id, and occurrences are assigned
later by core.reduce. Every field name read here must be verified against the
files in /fixtures. Never guess.

Definition of done
------------------
Every Finding produced validates against models.Finding, and file_path is never
absolute.
"""
