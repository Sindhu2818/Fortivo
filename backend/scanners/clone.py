"""Get the target repo onto local disk so the scanners can read it.

Responsibility
--------------
Accept a repo_url that is either a git URL or a local path. Local paths are used
in place. Git URLs are shallow-cloned (`git clone --depth 1`) into a temp dir.
Returns the local directory to scan plus a repo_name. Owns cleanup.

Definition of done
------------------
Given "./demo-app" returns that path unchanged; given a public GitHub URL returns
a temp dir containing the checked-out tree.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

_GIT_URL_PATTERN = re.compile(
    r"^(https?://|git@|ssh://|git://)",
    re.IGNORECASE,
)


class CloneError(Exception):
    """Raised when a repository cannot be prepared for scanning."""


def derive_repo_name(repo_url: str) -> str:
    """Last path segment of repo_url, per CONTRACT.md."""
    trimmed = repo_url.strip().rstrip("/\\")
    if not trimmed:
        raise CloneError("repo_url is empty")
    if _is_git_url(trimmed):
        if trimmed.lower().startswith("git@"):
            _, _, path_part = trimmed.partition(":")
            if path_part:
                return path_part.rstrip("/").rsplit("/", 1)[-1]
        return trimmed.rstrip("/").rsplit("/", 1)[-1]
    return Path(trimmed).name


def _is_git_url(repo_url: str) -> bool:
    return _GIT_URL_PATTERN.match(repo_url.strip()) is not None


@dataclass
class CloneResult:
    """Local tree to scan and metadata for ScanResult assembly."""

    scan_path: str
    repo_name: str
    _cleanup_dir: Optional[Path] = field(default=None, repr=False)

    def cleanup(self) -> None:
        """Remove a shallow-clone temp directory. No-op for local paths."""
        if self._cleanup_dir is None:
            return
        shutil.rmtree(self._cleanup_dir, ignore_errors=False)
        self._cleanup_dir = None

    def __enter__(self) -> CloneResult:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: object,
    ) -> None:
        self.cleanup()


def _prepare_local_path(repo_url: str) -> CloneResult:
    path = Path(repo_url)
    if not path.is_dir():
        raise CloneError(f"Local repository path is not a directory: {repo_url}")
    return CloneResult(
        scan_path=repo_url,
        repo_name=derive_repo_name(repo_url),
        _cleanup_dir=None,
    )


def _shallow_clone(repo_url: str) -> CloneResult:
    parent = Path(tempfile.gettempdir())
    target = parent / f"fortivo-clone-{uuid.uuid4().hex}"

    try:
        completed = subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, str(target)],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise CloneError("git executable not found on PATH") from exc

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        message = f"git clone failed (exit {completed.returncode})"
        if detail:
            message = f"{message}: {detail}"
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        raise CloneError(message)

    return CloneResult(
        scan_path=str(target.resolve()),
        repo_name=derive_repo_name(repo_url),
        _cleanup_dir=target,
    )


def prepare_repo(repo_url: str) -> CloneResult:
    """Return a scan directory and repo_name; call cleanup() when finished."""
    stripped = repo_url.strip()
    if not stripped:
        raise CloneError("repo_url is empty")

    if _is_git_url(stripped):
        return _shallow_clone(stripped)
    return _prepare_local_path(stripped)
