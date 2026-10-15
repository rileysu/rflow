---
name: investigate
description: Diagnose a bug's cause in a docs worktree, then hand off to tickets and finish.
argument-hint: <bug report>
disable-model-invocation: true
---

# Investigate

The bug report is `$ARGUMENTS`. Ask for one if it is empty.

1. Open the worktree.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open docs '<short bug title in letters, digits and spaces>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Call the Skill tool twice, for `mattpocock-skills:diagnosing-bugs` and `mattpocock-skills:domain-modeling`, and run the diagnosing phases from Build a feedback loop through Instrument on the bug. The Fix + regression test phase belongs to the implementation that follows the tickets. Done when the conversation holds all four.
   - the red loop command and its redacted output
   - the minimised repro
   - the hypothesis an Instrument probe confirmed, with the probe's evidence
   - the regression test seam, or the finding that no correct seam exists

3. Remove every `[DEBUG-...]` log and throwaway harness, leaving only domain doc changes in `git status`.

4. Read `${CLAUDE_PLUGIN_ROOT}/references/handoff.md` and follow it.
