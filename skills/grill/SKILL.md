---
name: grill
description: Grill a plan in a docs worktree, recording glossary terms and ADRs, then hand off to a spec and finish.
disable-model-invocation: true
---

# Grill

The topic is the skill's arguments. Ask for one if they are empty.

1. Open the worktree on `docs/<topic>`, where `<topic>` is a kebab-case slug of the topic in at most 5 words.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" branch docs/<topic>
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Call the Skill tool twice, for `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`, and grill the topic. Done when the user confirms a shared understanding.

3. Follow [spec-handoff.md](../../references/spec-handoff.md).
