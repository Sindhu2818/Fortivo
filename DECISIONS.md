# DECISIONS.md

## Why Trivy + Semgrep

Fortivo combines Trivy and Semgrep because they detect different classes of
security issues.

- **Trivy** focuses on dependency vulnerabilities, exposed secrets,
  Infrastructure-as-Code issues and configuration risks.
- **Semgrep** performs static code analysis and identifies insecure coding
  patterns directly in source code.

Using both scanners provides broader coverage while reducing blind spots.

---

## How reduction works

Raw scanner outputs often contain duplicate findings or multiple reports of the
same underlying issue.

The reduction stage performs the following:

1. Normalize all scanner outputs into a common schema.
2. Remove duplicate findings.
3. Merge repeated occurrences.
4. Rank findings by severity and exploitability.
5. Keep only the highest priority findings for presentation.

This keeps reports concise while preserving the most critical issues.

---

## The four score weights and why

The overall project risk score combines four categories.

- Dependency Vulnerabilities
- Source Code Issues
- Secrets Exposure
- Configuration Risks

Critical vulnerabilities contribute significantly more than Medium or Low
severity findings.

The combined weighted score is normalized to a value between **0 and 100** and
mapped into Low, Medium, High and Critical risk bands.

---

## How attack paths are generated

Attack paths connect related findings to illustrate how multiple weaknesses can
be chained together by an attacker.

Relationships are created using:

- Shared files
- Vulnerability categories
- Dependency relationships
- Configuration weaknesses

The resulting graph helps users understand realistic exploitation scenarios
instead of viewing each finding independently.

---

## Why the LLM narrates but never ranks

Risk prioritization is entirely deterministic and based on scanner outputs.

The LLM is responsible only for:

- Explaining findings in natural language.
- Generating remediation guidance.
- Producing an executive summary of the scan.

The LLM never changes severity levels, modifies the calculated risk score or
reorders findings. This ensures that Fortivo remains deterministic,
reproducible and suitable for security analysis.