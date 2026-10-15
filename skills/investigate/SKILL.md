---
name: investigate
description: Diagnose a bug's cause in a docs worktree, then hand off to a spec and finish.
disable-model-invocation: true
---

# Investigate

The bug report is the skill's arguments. Ask for one if they are empty.

1. Open the worktree on `docs/<bug-topic>`, where `<bug-topic>` is a kebab-case slug of the bug in at most 5 words.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" branch docs/<bug-topic>
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Call the Skill tool twice, for `mattpocock-skills:diagnosing-bugs` and `mattpocock-skills:domain-modeling`, and run diagnosing Phases 1 to 4 on the bug. The fix (Phase 5) belongs to the implementation that follows the spec. Done when the conversation holds all four.
   - the red loop command and its redacted output
   - the minimised repro
   - the hypothesis a Phase 4 probe confirmed, with the probe's evidence
   - the regression test seam, or the finding that no correct seam exists

3. Remove every `[DEBUG-...]` log and throwaway harness, leaving only domain doc changes in `git status`.

4. Follow [spec-handoff.md](../../references/spec-handoff.md).
