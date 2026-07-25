"""FastAPI app: the only HTTP surface of Fortivo.

Responsibility
--------------
Define the app, CORS for localhost:3000, and four routes. Nothing else — all real
work is delegated to core.pipeline. This file owns no business logic.

    GET  /health              -> {"ok": true}
    POST /scan                -> ScanAccepted   (kicks off core.pipeline.run_scan)
    GET  /results             -> list[ScanSummary]
    GET  /results/{scan_id}   -> ScanResult

Definition of done
------------------
`uvicorn main:app --port 8000` starts, and
`curl -X POST localhost:8000/scan -d '{"repo_url":"./demo-app"}' -H 'content-type: application/json'`
returns a scan_id whose document later loads from GET /results/{scan_id}.
"""
