# Changelog

## 0.5.0

- `rflow resolve [--not-planned] <issue> <file>` posts the file as a comment on a GitHub issue, then closes it as completed, or as not planned with `--not-planned`. It refuses a missing or empty file, an issue that is already closed and a tracker doc that does not name GitHub.

## 0.4.0

- `tweak-pr` makes the code changes and requirement changes your guidance asks of an open GitHub pull request on its own branch, shows each with the spec line or standard it rests on and the seam it is tested at, shows the spec and ticket lines a requirement change rewrites, including a ticket's parent spec and sibling tickets, and the glossary terms and ADRs it renames or reverses, before you confirm, edits them in place, commits the glossary and ADR edits before the code, reviews the whole pull request and pushes to it with `finish`.
- `rflow open head` opens a worktree on a same-repo open pull request's own branch, tracking `origin`, after fast-forwarding the default branch. It refuses a pull request that targets another branch. An existing local branch or rflow worktree catches up to `origin` or keeps its unpushed commits, and one that has diverged, or a branch checked out outside rflow's worktrees, is refused.

## 0.3.0

- `audit` sweeps a path, an area, a git ref or the hot spots that `rflow hotspots` ranks for bugs, deepening opportunities and doc drift, then logs the findings you pick as tickets.
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
