"""Collapse hundreds of raw findings down to the 30 that matter.

Responsibility
--------------
Two stages, in order:

1. **Dedup.** Group findings that are the same issue seen more than once — same
   rule_id + package across files, or same rule_id + file across lines. Keep one
   representative and set its `occurrences` to the group size.
2. **Rank.** Sort the survivors by importance (severity, cvss, category weight,
   occurrences, fix availability), assign dense 1-based `rank`, take the top 30,
   and assign `f_001`-style ids in rank order.

This module decides what the user sees. The LLM never reorders its output.

Definition of done
------------------
`stats.after_dedup < stats.raw_findings`, `len(findings) <= 30`, ranks are dense
and start at 1, and ids match rank order.
"""
