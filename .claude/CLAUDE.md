# rflow

A plugin of worktree flows around Matt Pocock's skills, for Claude Code and OpenCode. Flows live in `skills/`, prose that several flows share lives in `references/`, every deterministic step lives in `scripts/rflow`, and `opencode/` holds the OpenCode plugin that registers the same skills.

## Skills

- Before writing or editing a skill or a reference, call the Skill tool with `mattpocock-skills:writing-for-agents` and follow it. Prose here states each step positively, ends it on a checkable completion criterion, keeps each meaning in one place, and reads as full sentences rather than colon-led labels.
- Flows are user-invoked (`disable-model-invocation: true`), so they reach each other only through the user. `finish` is the one model-invoked skill, and flows call it with the Skill tool. A step that needs any user-invoked skill, ours or Pocock's, tells the user what to type (mattpocock/skills `.agents/invocation.md`).
- A rule the script enforces (branch names, worktree location, the base branch, trailer parsing, waiting for checks) lives only in `scripts/rflow`. Skills call the script and relay its errors.
- Claude Code and the OpenCode plugin substitute `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` only in SKILL.md text, so every script call sits in a SKILL.md and `references/` holds prose only.
- Skills keep Claude Code's wording, and the OpenCode plugin rewrites it at registration through the rewrite table in `opencode/rewrite-table.js` (`docs/adr/0001`). Write each Claude-only sentence word for word as its table entry, and add an entry for a new one, so that `node --test` passes.
- Text from a ticket, issue or user reaches a shell command in single quotes and cut down to letters, digits and spaces, or through a file (`--body-file`), since an issue title can carry `'` or `$(...)`. A path or git ref also keeps `./-_`, starts with a letter, digit, `.` or `_`, and follows `--` where git takes one.
- An adapted upstream skill opens with a comment naming the upstream path, commit, licence and what rflow changed. Re-sync it by diffing upstream from that commit.

## Script

- `scripts/rflow` runs on the bash 3.2 that macOS ships, so it sticks to bash 3.2 features.
- Every behaviour has a test in `tests/rflow.bats`, and each fixed bug gets the test that would have caught it.

## Checks and releases

- Before pushing, run the four checks under Development in `README.md`, which CI runs too.
- Every user-visible change bumps `version` in both `.claude-plugin/plugin.json` and `package.json` to the same value and adds one `CHANGELOG.md` entry, because installed users of either harness keep their copy until the version changes.
- Repo guidance lives in this file, since `validate --strict` rejects a `CLAUDE.md` at the plugin root.
