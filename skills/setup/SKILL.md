---
name: setup
description: Prepare a repo for rflow, with project settings and Matt Pocock's skill configuration, delivered through a worktree.
disable-model-invocation: true
---

# Setup

1. Open the worktree. The issue tracker does not exist yet, so `--no-tracker` skips that check.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open --no-tracker chore "rflow setup"
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Merge [settings.json](settings.json) into `.claude/settings.json`, keeping existing keys and letting the template win on conflicts.

   ```sh
   mkdir -p .claude && [ -f .claude/settings.json ] || echo '{}' > .claude/settings.json
   jq -s '.[0] * .[1]' .claude/settings.json "${CLAUDE_SKILL_DIR}/settings.json" > .claude/settings.json.tmp
   mv .claude/settings.json.tmp .claude/settings.json
   ```

   Show the user the resulting file and commit it.

3. Tell the user to type `/mattpocock-skills:setup-matt-pocock-skills`. It asks for the issue tracker, triage labels and domain doc layout, and writes `docs/agents/`.

4. In the same turn that `/mattpocock-skills:setup-matt-pocock-skills` finishes, commit its files and call the Skill tool with `rflow:finish`.
