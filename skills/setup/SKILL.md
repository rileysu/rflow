---
name: setup
description: Prepare a repo for rflow, with project settings and Matt Pocock's skill configuration, delivered through a worktree.
disable-model-invocation: true
---

# Setup

1. Open the worktree. The issue tracker does not exist yet, so `--no-tracker` skips that check.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open --no-tracker chore 'rflow setup'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree. When EnterWorktree or status fails, report the message and stop.

2. Merge [settings.json](settings.json) into the worktree's `.claude/settings.json`.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" settings "${CLAUDE_SKILL_DIR}/settings.json"
   ```

   Show the user the merged file it prints, and commit `.claude/settings.json`. When it fails, report its message and stop.

3. Tell the user to type `/mattpocock-skills:setup-matt-pocock-skills` and to pick GitHub or local markdown as the issue tracker, the two that rflow ships through. It asks for the issue tracker, triage labels and domain doc layout, and writes `docs/agents/`.

4. Create the shared docs directories. `docs/research/` holds research notes, one file per topic; `docs/adr/` holds architecture decision records, one per file, named `NNNN-slug.md`; `docs/misc/` holds documents that fit nowhere else in `docs/`.

   ```sh
   mkdir -p docs/research docs/adr docs/misc
   [ -f docs/research/README.md ] || printf '%s\n' '# Research notes' '' 'One file per topic. Flows reference them through context pointers.' > docs/research/README.md
   [ -f docs/adr/README.md ] || printf '%s\n' '# ADRs' '' 'Architecture decision records, one per file, named NNNN-slug.md. The domain-modeling flow creates them here.' > docs/adr/README.md
   [ -f docs/misc/README.md ] || printf '%s\n' '# Misc' '' 'Documents that fit nowhere else in docs/.' > docs/misc/README.md
   ```

   Existing files are left alone; only a missing README is created. Commit the two directories before the next step.

5. In the same turn that `/mattpocock-skills:setup-matt-pocock-skills` finishes, commit its files and call the Skill tool with `rflow:finish`.
