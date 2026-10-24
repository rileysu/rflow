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

4. Create the shared docs directories: `docs/research/` for research notes, one file per topic; `docs/adr/` for the ADRs the `/mattpocock-skills:domain-modeling` flow writes, one per file, named `NNNN-slug.md`; and `docs/misc/` for documents that fit nowhere else in `docs/`.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" docs
   ```

   It prints the one-line `README.md` it creates in each directory and leaves every existing file alone. Commit `docs/` before the next step. When it fails, report its message and stop.

5. In the same turn that `/mattpocock-skills:setup-matt-pocock-skills` finishes, commit its files, then create the labels rflow applies when the user picked GitHub as the issue tracker, then call the Skill tool with `rflow:finish`. With local markdown as the tracker, call `rflow:finish` straight after the commit.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" labels
   ```

   It creates only the labels the repo lacks and prints `created <label>` for each, which you report. When it fails, report its message and stop.
