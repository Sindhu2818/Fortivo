"""Compute the 0-100 repository risk score and its four components.

Responsibility
--------------
Turn the reduced finding list into models.Risk:

  * `components.severity`      — how bad the worst findings are
  * `components.exploitability`— public exploit / low attack complexity
  * `components.exposure`      — reachable from outside vs. internal only
  * `components.blast_radius`  — how much is reachable after compromise

Combine the four into a weighted 0-100 integer, derive `band` from the CONTRACT.md
thresholds (never set it independently), and write `score_contribution` back onto
each finding. `risk.summary` is left empty here — the LLM fills it later.

Every number in the output document originates in this file. Record the chosen
weights and their rationale in DECISIONS.md.

Definition of done
------------------
score is an int 0-100, band matches the thresholds, and the sum of
score_contribution is consistent with the score.
"""
