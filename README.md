# rflow

A Claude Code plugin that wraps [Matt Pocock's skills](https://github.com/mattpocock/skills) in worktree flows. Each flow opens a worktree at `../.worktrees/<repo>-<branch>`, runs the work, and ends with `/rflow:finish`, which opens a pull request (GitHub) or merges locally (local markdown tracker), and removes the worktree.

## Install

```sh
claude plugin marketplace add mattpocock/skills
claude plugin marketplace add rileysu/rflow
claude plugin install rflow@rflow
```

`mattpocock-skills` installs with it as a dependency. The flows also use `git`, `jq` during setup, and `gh` for a GitHub tracker and `/rflow:review-pr`.

## OpenCode

The same repository installs as an [OpenCode](https://opencode.ai) V2 plugin (OpenCode 2.0.4 or later). Point the config at a checkout of this repo:

```jsonc
{
  "plugins": ["/path/to/rflow"]
}
```

or install the git-backed package, which OpenCode updates at every server start:

```jsonc
{
  "plugins": ["@rileysu/rflow@git+https://github.com/rileysu/rflow.git"]
}
```

The plugin registers the nine flows as OpenCode skills plus `/rflow-<flow>` commands (OpenCode has no namespaced `/rflow:...`), rewrites `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` to real paths at load time, turns `disable-model-invocation` into `autoinvoke: false`, and appends a note mapping the Claude-only tools the flows name: `EnterWorktree` becomes running the following commands in the printed directory, `ExitWorktree` with action `keep` becomes just stopping until `rflow close` removes the worktree, and the `Agent` tool becomes `subagent`.

Pocock's skills install separately as OpenCode skills:

```sh
npx skills add mattpocock/skills -a opencode -g -s '*' -y
```

Allow the plugin directory in OpenCode's permissions, because the script it runs lives there:

```jsonc
{
  "permission": {
    "external_directory": {
      "/path/to/rflow": "allow"
    }
  }
}
```

A configured directory path loads live: pull or edit the repo and restart the OpenCode server to pick it up. The flows still assume rflow's layout — run them from the main checkout on the default branch — and the harness details outside the skills (worktree entry prompts, settings templates) are Claude Code's own.

## Flows

| Command | Branch | Does | You type |
| --- | --- | --- | --- |
| `/rflow:setup` | `chore/rflow-setup` | Writes `.claude/settings.json`, then Pocock's setup | `/mattpocock-skills:setup-matt-pocock-skills` |
| `/rflow:grill <topic>` | `docs/<topic>` | Grills with glossary and ADRs | `/mattpocock-skills:to-tickets`, after `/mattpocock-skills:to-spec` for a spec |
| `/rflow:investigate <bug>` | `docs/<bug>` | Diagnoses the cause, leaving the fix to the tickets | Same as grill |
| `/rflow:audit [scope]` | `docs/audit-<scope>`, or `docs/audit-<YYYY-MM-DD>` with no scope | Sweeps a path, area, git ref or the hot spots for bugs, deepening opportunities and doc drift, and logs the findings you pick | Same as grill |
| `/rflow:implement-ticket <ref>` | `feat/` or `fix/<title>` | Implements one ticket in session, reviewed until nothing blocks | Nothing |
| `/rflow:implement-spec <ref>` | `feat/<title>` | Implements a spec's tickets in parallel subagents, reviewed until nothing blocks | Nothing |
| `/rflow:review-pr <pr>` | Detached at the PR head | Two-axis code review, optionally posted | Confirmation to post |
| `/rflow:tweak-pr <pr> <guidance>` | The PR's own branch | Splits the guidance into cited code changes and requirement changes, edits the spec and its tickets for a requirement change, updates glossary terms and ADRs before the code, builds them, reviewed until nothing blocks | Confirmation when a change edits the spec, a glossary term or an ADR, or needs a new test seam |
| `/rflow:finish` | The current one | Ships and cleans up | Only after fixing a failed check |

Run every flow from the main checkout, on the default branch. Branches are named from the first five words of the topic or title, and start from the default branch after a fast-forward from its remote. `/rflow:tweak-pr` instead checks out the open pull request's own branch, tracking its remote. Pocock's own commands (`/mattpocock-skills:implement`, `/mattpocock-skills:implement-spec`, ...) stay available as manual variants.

The two implement flows and `/rflow:tweak-pr` run Pocock's `code-review` in a loop before they ship. A finding that cites a documented standard or a spec line blocks, and the loop asks you after three rounds that still block. Docs and setup branches ship without a code review.

Claude Code asks for approval each time a flow enters its worktree, because the worktree sits outside `.claude/worktrees/`. No permission rule skips that prompt, and declining it stops the flow.

`/rflow:finish` removes the worktree once checks pass, before the pull request merges. The branch stays on the remote for review comments that come later.

## Settings written by setup

`/rflow:setup` merges [skills/setup/settings.json](skills/setup/settings.json) into `.claude/settings.json`, keeping the keys already there and letting the template win where both set one. It registers the `mattpocock` and `rflow` marketplaces, enables `rflow@rflow`, and sets `disableBundledSkills: true`. That turns off Claude Code's bundled skills for everyone who works in the repo, so its built-in `/code-review` stops shadowing Pocock's and the bundled skills stop taking up context.

## Development

```sh
bats tests/                                   # script tests in throwaway repos
shellcheck -x scripts/rflow tests/rflow.bats
claude plugin validate . --strict
claude --plugin-dir .                         # try the flows, with mattpocock-skills installed
```

CI runs the first three. Conventions for skills and the script are in [.claude/CLAUDE.md](.claude/CLAUDE.md).

## License

MIT. `implement-ticket`, `implement-spec`, `audit` and `tweak-pr` adapt Matt Pocock's MIT-licensed skills, see [LICENSE](LICENSE).
