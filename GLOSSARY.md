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

**Hot spot**:
A file among those changed most often in recent history, and the default scope of an audit.
_Avoid_: Churn, busy file

**Tweak**:
A flow that makes the changes the guidance asks of an open pull request, editing its spec source for each requirement change.
_Avoid_: Amend, patch, revise

**Guidance**:
The user's words naming what to change in a pull request.
_Avoid_: Feedback, comments, instructions

**Spec source**:
The issue a pull request implements, a spec or a ticket, or its body when it names neither, stating what the pull request must do.
_Avoid_: Requirement source, requirements

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

## Change kinds

**Code change**:
A change the guidance asks for that leaves the spec source as it is.
_Avoid_: Fix, adjustment, small change

**Requirement change**:
A change the guidance asks for that rewords, contradicts or adds to what the spec source asks for.
_Avoid_: Spec change, scope change, follow-up, addition
