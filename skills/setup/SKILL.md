---
name: setup
description: Prepare a repo for rflow, with project settings and Matt Pocock's skill configuration, delivered through a worktree.
disable-model-invocation: true
---

# Setup

1. Check for an existing tracker first, using the `main_checkout` path from `"${CLAUDE_PLUGIN_ROOT}/scripts/context.sh"`. When `docs/agents/issue-tracker.md` already exists there, report it and open the worktree without `--no-tracker`; step 3 is then skipped because Pocock's setup writes `docs/agents/` and would change nothing. When it is missing, `--no-tracker` skips that check.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" branch chore/rflow-setup
   # or, when the tracker is missing:
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" branch --no-tracker chore/rflow-setup
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Merge [settings.json](settings.json) into `.claude/settings.json`, keeping existing keys and letting the template win on conflicts.

   ```sh
   mkdir -p .claude && [ -f .claude/settings.json ] || echo '{}' > .claude/settings.json
   jq -s '.[0] * .[1]' .claude/settings.json "${CLAUDE_SKILL_DIR}/settings.json" > .claude/settings.json.tmp
   mv .claude/settings.json.tmp .claude/settings.json
   ```

   Show the user the resulting file and commit it.

3. When step 1 found an existing tracker, skip this step. Otherwise tell the user to type `/mattpocock-skills:setup-matt-pocock-skills`. It asks for the issue tracker, triage labels and domain doc layout, and writes `docs/agents/`.

4. When step 3 was skipped (tracker already existed), call the Skill tool with `rflow:finish` after the step 2 commit. Otherwise, in the same turn that `/mattpocock-skills:setup-matt-pocock-skills` finishes, commit its files and call the Skill tool with `rflow:finish`.
