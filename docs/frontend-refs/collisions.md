# Colour Collisions

Three parts of the dashboard want to use colour to mean different things at the same
time. These rules keep them from reading as each other.

## 1. Severity owns red / orange / amber / grey

Red, orange, amber and grey are reserved for the severity ramp
(critical / high / medium / low) and mean nothing else anywhere in the app. No other
component may use them decoratively — not for buttons, states, borders or charts.

## 2. Diff viewer uses tints, not fills

Added and removed lines are marked with a low-opacity tint plus a 2px left border.
No solid background fills, no saturated red or green blocks — a full-strength fill
would compete with the severity ramp and make a removed line look like a critical
finding.

## 3. Attack-path nodes carry severity on the border only

Attack-path nodes use lucide icons — `KeyRound`, `GitBranch`, `Crosshair` — drawn in
neutral text colour. The node's border is coloured by the severity of the finding it
links to. Severity is never applied to the icon or the node fill, so the graph reads
as structure first and severity second.
