---
name: tweak-pr
description: Make the changes your guidance asks of an open GitHub pull request on its own branch, review it until nothing blocks, then push it with rflow:finish.
argument-hint: <pull request number or URL> <guidance>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md (the build) and skills/engineering/code-review/SKILL.md (its two sub-agents, given a brief that splits the guidance) at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree on the pull request's own branch, the split of the guidance into cited changes, the one-session limit, a bounded review loop in place of the single review, and the hand-off to rflow:finish. -->

# Tweak PR

`$ARGUMENTS` holds the pull request, a number or URL, as its first word and the **guidance** as the rest. Ask for whichever is missing. The guidance reaches skills and sub-agents as prompt text, and reaches a shell command only through a file. Stopping without edits means telling the user why and that `/rflow:finish` removes the worktree.

1. Open a worktree on the pull request's own branch.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open head '<number-or-url>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree, and keep its `base` and `ref` lines for step 8. When `open`, EnterWorktree or status fails, report the message and stop.

2. Read the pull request with `gh pr view '<number-or-url>' --json number,baseRefName,body`, and run `git fetch origin <baseRefName>`. The fixed point is `origin/<baseRefName>`. The spec sources are the `ref` lines from step 1 and each issue the body closes (`Closes #N`), read with `gh issue view N`. When there are none, the pull request body is the spec source.

3. Split the guidance into **changes**. Call the Skill tool with `mattpocock-skills:code-review`, passing the fixed point, the spec sources from step 2 and the guidance. Tell it that this brief replaces both of its sub-agent briefs: "Split the guidance into separate changes, one per thing it asks for, and return each change with the line it rests on, or `none`. The Spec sub-agent cites a spec source line and marks each change a code change when it leaves the spec source as it is, or a requirement change when it rewords, contradicts or adds to what the spec source asks for. The Standards sub-agent cites a documented standard, file and rule. Under 400 words." Tell both sub-agents to read the code themselves, without calling skills or starting agents of their own. Tell code-review too that step 5 of this flow merges its two reports into one table, in place of its rule to keep the axes apart. Done when both reports are in.

4. Settle each part of the guidance that maps to no concrete change, such as "make it cleaner", with the Skill tool, calling `mattpocock-skills:grilling` on those parts alone. Keep it short, with as many questions as those parts need, and end the grill once each part maps to a concrete change. Skip this step when every part already does.

5. State the split in chat as one table with the columns Change, Kind and Citation. Kind is **code change** or **requirement change**, and Citation is the spec line or standard from step 3, or `none`. When every change is a code change, go on without asking. When any change is a requirement change, name it and stop without edits, since this flow builds code changes only.

6. Size the changes against Pocock's `to-tickets` rule, that a slice fits in a single fresh context window. When the changes together exceed one session, name the changes and stop without edits.

7. Build the changes. For each change that alters behaviour, call the Skill tool with `mattpocock-skills:tdd` at pre-agreed seams, and run typechecking and the affected test file after each red-green cycle. Make each change that alters no behaviour, such as prose, a rename or formatting, as a direct edit. Commit each change once the full test suite passes, with a message that describes the change itself, as if it had always been part of the pull request, and with no trailers, so the `ref` lines stay as step 1 printed them. Done when every change in the table is committed, every behaviour change has a passing test, and the full test suite passes.

8. Read `${CLAUDE_PLUGIN_ROOT}/references/review-loop.md` and follow it, with the `base` branch and the `ref` lines from step 1. The loop reviews the whole pull request against its base.

9. Call the Skill tool with `rflow:finish` to push the branch to the pull request.
