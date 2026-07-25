"""Read and write scan documents as JSON files under ./results/.

Responsibility
--------------
The only module that touches the filesystem for results. Owns the scan_id format
(`scan_<YYYYMMDD>_<HHMMSS>`), the results directory path, and serialization of
ScanResult to and from disk. No database, ever.

    new_scan_id() -> str
    save(result: ScanResult) -> Path
    load(scan_id: str) -> ScanResult
    list_summaries() -> list[ScanSummary]   # newest first

Definition of done
------------------
A saved document round-trips: load(save(r).stem) validates against models.ScanResult.
"""
