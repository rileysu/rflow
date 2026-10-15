# Changelog

## 0.2.0

- `scripts/rflow` replaces the four worktree scripts, with tests and CI.
- `implement-ticket` and `implement-spec` review in a loop until nothing blocks, and `finish` only ships.
- `review-pr` works with any `gh`, where it needed `gh pr checkout --worktree` from gh 2.98.0, and no longer needs the tracker.
- `finish` waits for checks that have not registered yet, leaves the worktree before a local merge, and resolves local tickets in the `**Status:**` form that `to-tickets` writes.
- The first flow after a merged setup pull request fast-forwards before it looks for the tracker.
- Flows refuse to start when the main checkout is off the default branch.

## 0.1.0

- First release: `setup`, `grill`, `investigate`, `implement-ticket`, `implement-spec`, `review-pr` and `finish`.
