---
name: grill
description: Grill a plan in a docs worktree, recording glossary terms and ADRs, then hand off to tickets and finish.
argument-hint: <topic>
disable-model-invocation: true
---

# Grill

The topic is `$ARGUMENTS`. Ask for one if it is empty.

1. Open the worktree.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open docs '<short topic title>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Call the Skill tool twice, for `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`, and grill the topic. Done when the user confirms a shared understanding.

3. Read `${CLAUDE_PLUGIN_ROOT}/references/handoff.md` and follow it.
