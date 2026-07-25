"""Read and write scan documents as JSON files under ./results/.

Responsibility
--------------
The only module that touches the filesystem for results. Owns the scan_id format
(``scan_<YYYYMMDD>_<HHMMSS>``), the results directory path, and serialization of
ScanResult to and from disk. No database, ever.

    new_scan_id() -> str
    save(result: ScanResult) -> Path
    load(scan_id: str) -> ScanResult
    list_summaries() -> list[ScanSummary]   # newest first

Definition of done
------------------
A saved document round-trips: load(save(r).stem) validates against models.ScanResult.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Union

from pydantic import ValidationError

from models import Band, ScanResult, ScanStatus, ScanSummary

# Default results directory relative to project root
DEFAULT_RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"


# ---------------------------------------------------------------------------
# Public Functions
# ---------------------------------------------------------------------------


def new_scan_id(now: Optional[datetime] = None) -> str:
    """Generate a unique scan_id string in the format scan_YYYYMMDD_HHMMSS.

    Args:
        now: Optional datetime override for deterministic testing. Defaults to UTC now.
    """
    ts = now or datetime.now(timezone.utc)
    return f"scan_{ts.strftime('%Y%m%d_%H%M%S')}"


def save(
    result: ScanResult,
    results_dir: Optional[Union[Path, str]] = None,
) -> Path:
    """Serialize a ScanResult to JSON and write it to results/<scan_id>.json.

    Args:
        result: Validated ScanResult object to persist.
        results_dir: Optional custom results directory path.

    Returns:
        Path to the saved JSON file.

    Raises:
        OSError: If directory creation or file writing fails.
    """
    target_dir = _resolve_results_dir(results_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    json_str = serialize_scan_result(result)
    file_path = target_dir / f"{result.scan_id}.json"

    file_path.write_text(json_str, encoding="utf-8")
    return file_path


def load(
    scan_id: str,
    results_dir: Optional[Union[Path, str]] = None,
) -> ScanResult:
    """Read results/<scan_id>.json from disk and deserialize into a ScanResult.

    Args:
        scan_id: Scan ID or filename stem (e.g. scan_20260725_142301).
        results_dir: Optional custom results directory path.

    Returns:
        Fully validated ScanResult instance.

    Raises:
        FileNotFoundError: If the scan document does not exist.
        ValueError: If file content is invalid JSON or fails schema validation.
    """
    target_dir = _resolve_results_dir(results_dir)
    clean_id = scan_id.replace(".json", "")
    file_path = target_dir / f"{clean_id}.json"

    if not file_path.is_file():
        raise FileNotFoundError(f"Scan document not found: {file_path}")

    try:
        content = file_path.read_text(encoding="utf-8")
    except OSError as err:
        raise OSError(f"Failed to read scan document {file_path}: {err}") from err

    return deserialize_scan_result(content)


def list_summaries(
    results_dir: Optional[Union[Path, str]] = None,
) -> List[ScanSummary]:
    """Scan the results directory for JSON scan files and return summary records.

    Args:
        results_dir: Optional custom results directory path.

    Returns:
        List of ScanSummary models, ordered by scanned_at descending (newest first).
    """
    target_dir = _resolve_results_dir(results_dir)
    if not target_dir.is_dir():
        return []

    summaries: List[ScanSummary] = []
    for file_path in target_dir.glob("*.json"):
        try:
            content = file_path.read_text(encoding="utf-8")
            summary = parse_scan_summary(content)
            if summary:
                summaries.append(summary)
        except (OSError, ValueError):
            # Non-fatal error reading individual summary row
            continue

    # Sort newest first by scanned_at timestamp
    summaries.sort(key=lambda s: s.scanned_at, reverse=True)
    return summaries


# ---------------------------------------------------------------------------
# Pure Serialization / Deserialization Logic (Separated from I/O)
# ---------------------------------------------------------------------------


def serialize_scan_result(result: ScanResult) -> str:
    """Convert a ScanResult model into a formatted, deterministic JSON string.

    Uses by_alias=True to preserve CONTRACT.md field aliases (e.g. "from" in AttackEdge).
    """
    return result.model_dump_json(indent=2, by_alias=True)


def deserialize_scan_result(json_str: str) -> ScanResult:
    """Parse a raw JSON string into a validated ScanResult model.

    Raises:
        ValueError: If JSON is malformed or violates ScanResult schema invariants.
    """
    try:
        return ScanResult.model_validate_json(json_str)
    except ValidationError as val_err:
        raise ValueError(f"Invalid ScanResult JSON schema: {val_err}") from val_err
    except json.JSONDecodeError as dec_err:
        raise ValueError(f"Malformed JSON document: {dec_err}") from dec_err


def parse_scan_summary(json_str: str) -> Optional[ScanSummary]:
    """Extract lightweight ScanSummary metadata from a raw scan JSON string."""
    try:
        data = json.loads(json_str)
        risk_data = data.get("risk") or {}
        return ScanSummary(
            scan_id=str(data["scan_id"]),
            repo_name=str(data["repo_name"]),
            scanned_at=str(data["scanned_at"]),
            status=str(data["status"]),  # type: ignore[arg-type]
            score=int(risk_data["score"]),
            band=str(risk_data["band"]),  # type: ignore[arg-type]
        )
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------


def _resolve_results_dir(custom_dir: Optional[Union[Path, str]]) -> Path:
    """Resolve target results directory to a Path object."""
    if custom_dir is not None:
        return Path(custom_dir).resolve()
    return DEFAULT_RESULTS_DIR

