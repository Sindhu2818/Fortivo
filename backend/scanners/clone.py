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
