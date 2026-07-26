"""Get the target repo onto local disk so the scanners can read it.

Responsibility
--------------
Accept a repo_url that is either a git URL or a local path. Local paths are used
in place. Git URLs are shallow-cloned (`git clone --depth 1`) into a temp dir.
Returns the local directory to scan plus a repo_name. Owns cleanup.

Definition of done
------------------
Given "./demo-app", resolves it relative to the project root and returns
the absolute path to the local repository; given a public GitHub URL returns
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


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def resolve_local_path(repo_url: str) -> Path:
    """Resolve a local repo_url the one way the whole backend agrees on.

    Relative paths resolve against the project root, not the process's current
    working directory, so "./demo-app" means the same thing wherever uvicorn was
    started from.

    This is the single source of truth on purpose: utils/validators.py used to
    resolve the same string against the cwd, which made the two disagree about
    what a relative path meant and left *no* relative path that satisfied both.
    Both callers go through here now.
    """
    path = Path(repo_url)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def _prepare_local_path(repo_url: str) -> CloneResult:
    path = resolve_local_path(repo_url)

    if not path.is_dir():
        raise CloneError(f"Local repository path is not a directory: {repo_url}")

    return CloneResult(
        scan_path=str(path),
        repo_name=derive_repo_name(str(path)),
        _cleanup_dir=None,
    )


def shallow_clone(repo_url: str) -> CloneResult:
    parent = Path(tempfile.gettempdir())
    target = parent / f"fortivo-clone-{uuid.uuid4().hex}"

    try:
        config = subprocess.run(
            ["git", "config", "--list", "--show-origin"],
            capture_output=True,
            text=True,
        )

        print("===== GIT CONFIG =====")
        print(config.stdout)
        print(config.stderr)

        version = subprocess.run(
            ["git", "--version"],
            capture_output=True,
            text=True,
        )

        print("===== GIT VERSION =====")
        print(version.stdout)

        print("===== REPO URL =====")
        print(repo_url)

        completed = subprocess.run(
            [
                "git",
                "-c", "credential.helper=",
                "-c", "core.askPass=",
                "-c", "http.extraHeader=",
                "clone",
                "--depth",
                "1",
                repo_url,
                str(target),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise CloneError("git executable not found on PATH") from exc

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise CloneError(f"git clone failed (exit {completed.returncode}): {detail}")

    return CloneResult(
        scan_path=str(target),
        repo_name=derive_repo_name(repo_url),
        _cleanup_dir=target,
    )

def prepare_repo(repo_url: str) -> CloneResult:
    """Return a scan directory and repo_name; call cleanup() when finished."""
    stripped = repo_url.strip()
    if not stripped:
        raise CloneError("repo_url is empty")

    if _is_git_url(stripped):
        return shallow_clone(stripped)
    return _prepare_local_path(stripped)
