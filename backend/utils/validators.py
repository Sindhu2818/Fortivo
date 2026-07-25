from pathlib import Path
from urllib.parse import urlparse


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

    # Local directory
    if repo_url.startswith(".") or repo_url.startswith("/"):
        path = Path(repo_url)

        if not path.exists():
            raise ValueError(f"Local path '{repo_url}' does not exist.")

        if not path.is_dir():
            raise ValueError(f"'{repo_url}' is not a directory.")

        return

    # GitHub URL
    parsed = urlparse(repo_url)

    if parsed.scheme in ("http", "https") and parsed.netloc == "github.com":
        return

    raise ValueError(
        "Repository must be a local folder or a GitHub repository URL."
    )