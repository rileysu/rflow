---
name: setup
description: Prepare a repo for rflow in one command, with Claude Code and OpenCode project settings, the GitHub tracker, single-context domain docs and labels, delivered through a worktree.
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/setup-matt-pocock-skills/SKILL.md and its supporting files at 24fe0ef (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow always writes the GitHub tracker doc and the single-context domain doc, removes the explore, ask, draft and confirm steps, the other trackers, the multi-context layout and the triage labels and PR triage section, and runs the result inside its own worktree flow. -->

# Setup

Setup runs every step below in one go, with no question for the user. It always chooses the GitHub tracker and a single-context layout, and the pull request body states both choices for the user to review. When a command fails, report its message and stop.

1. Open the worktree. The issue tracker doc does not exist yet, so `--no-tracker` skips that check.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open --no-tracker chore 'rflow setup'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree.

2. Merge both harness templates on every run, so teammates on Claude Code and OpenCode share the repo: [settings.json](settings.json) into the worktree's `.claude/settings.json`, and [opencode.json](opencode.json) into its `opencode.json`.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" settings "${CLAUDE_SKILL_DIR}/settings.json"
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" settings "${CLAUDE_SKILL_DIR}/opencode.json"
   ```

   Report each merged file the commands print.

3. Write the tracker and domain docs from [issue-tracker-github.md](issue-tracker-github.md) and [domain.md](domain.md), running from the worktree root.

   ```sh
   mkdir -p docs/agents
   cp "${CLAUDE_SKILL_DIR}/issue-tracker-github.md" docs/agents/issue-tracker.md
   cp "${CLAUDE_SKILL_DIR}/domain.md" docs/agents/domain.md
   ```

4. Write the block below into `CLAUDE.md` at the worktree root when that file exists, else into `AGENTS.md` when that file exists, else into a new `CLAUDE.md`. Replace an existing `## Agent skills` section in place, along with its subsections, and otherwise append the block, leaving every other section as it is. The step is done when the file holds exactly one `## Agent skills` section.

   ```markdown
   ## Agent skills

   ### Issue tracker

   Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

   ### Domain docs

   Single-context: root `GLOSSARY.md` + `docs/adr/`; research notes under `docs/research/`, documents that fit nowhere else under `docs/misc/`. See `docs/agents/domain.md`.
   ```

5. Create the shared docs directories: `docs/research/` for research notes, one file per topic; `docs/adr/` for the ADRs the `rflow:domain-modeling` skill writes, one per file, named `NNNN-slug.md`; and `docs/misc/` for documents that fit nowhere else in `docs/`.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" docs
   ```

   It prints the one-line `README.md` it creates in each directory and leaves every existing file alone.

6. Create the labels rflow applies. This is setup's first `gh` command, so in a repo with no GitHub remote it fails here.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" labels
   ```

   It creates only the labels the repo lacks and prints `created <label>` for each, which you report.

7. Commit everything the steps above wrote, naming the file that holds the block. Skip the commit when `git status --short` prints nothing, which means a re-run changed no file.

   ```sh
   git add -- .claude/settings.json opencode.json docs '<the file that holds the block>'
   git commit -m 'chore: set up rflow with the GitHub tracker and a single-context layout'
   ```

8. In the same turn, call the Skill tool with `rflow:finish`.
