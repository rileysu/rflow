# rflow

A Claude Code plugin of worktree flows around Matt Pocock's skills. Flows live in `skills/`, prose that several flows share lives in `references/`, and every deterministic step lives in `scripts/rflow`.

## Skills

- Before writing or editing a skill or a reference, call the Skill tool with `mattpocock-skills:writing-for-agents` and follow it. Prose here states each step positively, ends it on a checkable completion criterion, keeps each meaning in one place, and reads as full sentences rather than colon-led labels.
- Flows are user-invoked (`disable-model-invocation: true`), so they reach each other only through the user. `finish` is the one model-invoked skill, and flows call it with the Skill tool. A step that needs any user-invoked skill, ours or Pocock's, tells the user what to type (mattpocock/skills `.agents/invocation.md`).
- A rule the script enforces (branch names, worktree location, the base branch, trailer parsing, waiting for checks) lives only in `scripts/rflow`. Skills call the script and relay its errors.
- Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` only in SKILL.md text, so every script call sits in a SKILL.md and `references/` holds prose only.
- Text from a ticket, issue or user reaches a shell command only inside single quotes, since an issue title can carry `$(...)`.
- An adapted upstream skill opens with a comment naming the upstream path, commit, licence and what rflow changed. Re-sync it by diffing upstream from that commit.

## Script

- `scripts/rflow` runs on the bash 3.2 that macOS ships, so it sticks to bash 3.2 features.
- Every behaviour has a test in `tests/rflow.bats`, and each fixed bug gets the test that would have caught it.

## Checks and releases

- Before pushing, run the three checks under Development in `README.md`, which CI runs too.
- Every user-visible change bumps `version` in `.claude-plugin/plugin.json` and adds a `CHANGELOG.md` entry, because installed users keep their copy until the version changes.
- Repo guidance lives in this file, since `validate --strict` rejects a `CLAUDE.md` at the plugin root.
