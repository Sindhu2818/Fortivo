"""Chain individual findings into 2-5 step multi-stage attack paths.

Responsibility
--------------
Deterministic, in Python: group ranked findings into plausible kill chains by
stage (entry point -> execution -> credential access -> lateral movement /
impact), using category, file locality, and severity. Emit models.AttackPath
objects with ordered `steps` and directed acyclic `edges`, at most 5 paths.

`title` and `narrative` are left empty here — the LLM writes those later. The
graph structure is never LLM-generated.

Definition of done
------------------
`attack_paths` is non-empty for the demo app, every step/edge finding_id resolves
to a reported finding, and no path contains a cycle.
"""
