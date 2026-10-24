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
A flow that makes the changes the guidance asks of an open pull request, editing each issue, glossary term and ADR that states a requirement or decision it changes.
_Avoid_: Amend, patch, revise

**Guidance**:
The user's words naming what to change in a pull request.
_Avoid_: Feedback, comments, instructions

**Spec source**:
An issue that states what a pull request must do, being a spec or ticket it implements or an issue it closes, or its body when it names none. A pull request can have several.
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

## Wayfinding

**Wayfinder**:
A flow that charts an effort too big for one session as a map of decision tickets, then resolves them one per session until the way to the destination is clear.
_Avoid_: Planner, roadmap

**Map**:
The issue that indexes one wayfinder effort, naming its destination and listing the decisions made so far, the fog and what is out of scope.
_Avoid_: Epic, plan, roadmap

**Destination**:
What reaching the end of a map looks like, being a spec to hand off, a decision to lock or a change made in place.
_Avoid_: Goal, outcome, target

**Decision ticket**:
A child issue of a map holding one question whose resolution is a decision, not a slice of a build to execute.
_Avoid_: Task, story, implementation ticket

**Frontier**:
The decision tickets of a map that are open, unclaimed and blocked by no open ticket.
_Avoid_: Backlog, queue, ready list

**Fog**:
The decisions a map can tell are coming but cannot yet phrase sharply enough to ticket.
_Avoid_: Backlog, unknowns, TBD

**Resolution comment**:
The closing comment on an issue that records its answer, such as a decision ticket's decision.
_Avoid_: Answer, summary, closing note

**Prototype branch**:
A branch holding a throwaway prototype that a decision ticket links to, pushed and never merged.
_Avoid_: Spike, experiment branch
