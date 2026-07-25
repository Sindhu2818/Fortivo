"""Orchestrate one scan end to end. The only place stage order is defined.

Responsibility
--------------
    clone -> trivy + semgrep -> normalize -> reduce -> score -> attack_paths
          -> llm -> assemble ScanResult -> storage.save

Owns timing (`duration_seconds`), `stats` assembly, `status` transitions, and
collecting non-fatal failures into `errors`. Every stage is skippable: a failed
scanner or a failed LLM call degrades the document, it does not fail the scan.

Definition of done
------------------
`run_scan("./demo-app")` writes results/<scan_id>.json that validates against
models.ScanResult with a non-zero score and at least one attack path.
"""
