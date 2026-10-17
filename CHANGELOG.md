# Changelog

## 0.3.0

- `grill` and `investigate` label every ticket they publish `bug` or `enhancement` through the tracker's label operation, beside `ready-for-agent`.

## 0.2.1

- `setup` merges its settings with `rflow settings`, which leaves a `.claude/settings.json` that is not valid JSON as it was and stops when `jq` is missing. The merge used to empty the file in both cases.
- Flows stop when the session does not reach its worktree, as when the EnterWorktree prompt is declined, where they carried on in the main checkout.

## 0.2.0

- `scripts/rflow` replaces the four worktree scripts, with tests and CI.
- `implement-ticket` and `implement-spec` review in a loop until nothing blocks, and `finish` only ships.
- `review-pr` works with any `gh`, where it needed `gh pr checkout --worktree` from gh 2.98.0, and no longer needs the tracker.
- `finish` waits for checks that have not registered yet, leaves the worktree before a local merge, and resolves local tickets in the `**Status:**` form that `to-tickets` writes.
- The first flow after a merged setup pull request fast-forwards before it looks for the tracker.
- Flows refuse to start when the main checkout is off the default branch.
- Ticket titles and pull request bodies reach the shell without breaking on quotes or running `$(...)`.

## 0.1.0

- First release: `setup`, `grill`, `investigate`, `implement-ticket`, `implement-spec`, `review-pr` and `finish`.
