from urllib.parse import urlparse

from scanners.clone import resolve_local_path


def validate_repo_input(repo_url: str) -> None:
    """
    Validate that the supplied repository is either:
      - an existing local directory
      - a valid GitHub repository URL

    Raises:
        ValueError if invalid.
    """

    repo_url = repo_url.strip()

    if not repo_url:
        raise ValueError("Repository path cannot be empty.")

    # Local directory. Resolved through scanners.clone so this agrees with the
    # path the scanner will actually read — validating a different path than the
    # one that gets scanned is what made "./demo-app" and "../demo-app" both
    # fail, each at a different layer.
    if repo_url.startswith(".") or repo_url.startswith("/"):
        path = resolve_local_path(repo_url)

        if not path.exists():
            raise ValueError(
                f"Local path '{repo_url}' does not exist (resolved to {path})."
            )

        if not path.is_dir():
            raise ValueError(f"'{repo_url}' is not a directory (resolved to {path}).")

        return

    # GitHub URL
    parsed = urlparse(repo_url)

    if parsed.scheme in ("http", "https") and parsed.netloc == "github.com":
        return

    raise ValueError(
        "Repository must be a local folder or a GitHub repository URL."
    )