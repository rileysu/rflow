# rflow

A Claude Code plugin that wraps [Matt Pocock's skills](https://github.com/mattpocock/skills) in worktree flows. Each flow opens a worktree at `../.worktrees/<repo>-<branch>`, runs the work, and ends with `/rflow:finish`, which reviews the branch, opens a pull request (GitHub) or merges locally (local markdown tracker), and removes the worktree.

## Install

```sh
claude plugin marketplace add mattpocock/skills
claude plugin marketplace add rileysu/rflow
claude plugin install rflow@rflow
```

`mattpocock-skills` installs with it as a dependency.

## Flows

| Command | Branch | Does | You type |
| --- | --- | --- | --- |
| `/rflow:setup` | `chore/rflow-setup` | Writes `.claude/settings.json`, then Pocock's setup | `/mattpocock-skills:setup-matt-pocock-skills` |
| `/rflow:grill <topic>` | `docs/<topic>` | Grills with glossary and ADRs | `/mattpocock-skills:to-tickets`, after `/mattpocock-skills:to-spec` for a spec |
| `/rflow:investigate <bug>` | `docs/<bug-topic>` | Diagnoses the cause, leaving the fix to the tickets | Same as grill |
| `/rflow:implement-ticket <ref>` | `feat/` or `fix/<slug>` | Implements one ticket in session | Nothing |
| `/rflow:implement-spec <ref>` | `feat/<slug>` | Implements a spec's tickets in parallel subagents | Nothing |
| `/rflow:review-pr <pr>` | Detached at the PR head | Two-axis code review, optionally posted | Confirmation to post |
| `/rflow:finish` | The current one | Reviews, ships and cleans up | Only after fixing a failed check |

Run every flow from the main checkout, on the default branch. New branches start from it after a fast-forward from its remote. Pocock's own commands (`/mattpocock-skills:implement`, `/mattpocock-skills:implement-spec`, ...) stay available as manual variants.

`/rflow:finish` removes the worktree once checks pass, before the pull request merges. The branch stays on the remote, and `/rflow:review-pr` reopens it.

## Settings written by setup

`/rflow:setup` merges this into `.claude/settings.json`.

- `disableBundledSkills: true`
- `extraKnownMarketplaces` for `mattpocock` and `rflow`
- `enabledPlugins` for `rflow@rflow`

## License

MIT. `implement-ticket` and `implement-spec` adapt Matt Pocock's MIT-licensed skills, see [LICENSE](LICENSE).
