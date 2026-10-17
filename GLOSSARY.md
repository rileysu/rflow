# rflow

Worktree flows around Matt Pocock's skills, each running one piece of work in its own worktree and ending in a pull request or local merge.

## Language

**Flow**:
A user-invoked rflow skill that opens a worktree, runs one piece of work in it, and ends with `rflow:finish`.
_Avoid_: Command, workflow, pipeline

**Audit**:
A flow that sweeps a scope of the repo for findings and logs the ones the user picks to the issue tracker.
_Avoid_: Sweep, survey, scan

**Finding**:
One problem an audit reports, carrying a location and the evidence its category demands.
_Avoid_: Issue, problem, defect

## Finding categories

**Bug**:
A finding where behaviour differs from what the code, its tests or its docs intend, shown by a red feedback loop.
_Avoid_: Defect, error

**Deepening opportunity**:
A finding where a shallow module, a leaking seam or a missing seam could be refactored into a deep module, shown by the deletion test.
_Avoid_: Structural issue, tech debt, refactor candidate

**Doc drift**:
A finding where a doc contradicts the code or another doc, shown by quoting both sides.
_Avoid_: Doc inconsistency, stale docs
