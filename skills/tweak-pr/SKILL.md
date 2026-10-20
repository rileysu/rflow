---
name: tweak-pr
description: Make the changes your guidance asks of an open GitHub pull request on its own branch, review it until nothing blocks, then push it with rflow:finish.
argument-hint: <pull request number or URL> <guidance>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md (the build), skills/engineering/code-review/SKILL.md (its two sub-agents, given a brief that splits the guidance) and skills/engineering/wayfinder/SKILL.md (updating the tickets a decision invalidates, applied to the spec source) at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree on the pull request's own branch, the split of the guidance into cited changes, the in-place edit of the spec source for a requirement change, the one-session limit, a bounded review loop in place of the single review, and the hand-off to rflow:finish. -->

# Tweak PR

`$ARGUMENTS` holds the pull request, a number or URL, as its first word and the **guidance** as the rest. Ask for whichever is missing. The guidance reaches skills and sub-agents as prompt text, and reaches a shell command only through a file. The pull request reaches a shell command as its number, digits only, taken from the `/pull/<number>` part when it is a URL. Stopping without edits means telling the user why and that `/rflow:finish` removes the worktree.

1. Open a worktree on the pull request's own branch.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open head '<number>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree, and keep its `base` and `ref` lines for step 9. When `open`, EnterWorktree or status fails, report the message and stop.

2. Read the pull request with `gh pr view '<number>' --json baseRefName,body`, and run `git fetch origin -- '<baseRefName>'`. The fixed point is `origin/<baseRefName>`. The spec sources are the `ref` lines from step 1 and each issue the body closes (`Closes #N`), read with `gh issue view N`. When there are none, the pull request body is the spec source. Done when `git rev-parse origin/<baseRefName>` succeeds and every spec source is read.

3. Split the guidance into **changes**. Call the Skill tool with `mattpocock-skills:code-review`, passing the fixed point, the spec sources from step 2 and the guidance. Tell it that this brief replaces both of its sub-agent briefs: "Split the guidance into separate changes, one per thing it asks for, and return each change with the line it rests on, or `none`. The Spec sub-agent cites a spec source line and marks each change a code change when it leaves the spec source as it is, or a requirement change when it rewords, contradicts or adds to what the spec source asks for. The Standards sub-agent cites a documented standard, file and rule. Under 400 words." Tell both sub-agents to read the code themselves, without calling skills or starting agents of their own. Tell code-review too that step 6 of this flow merges its two reports into one table, in place of its rule to keep the axes apart. Done when both reports are in.

4. Settle each part of the guidance that maps to no concrete change, such as "make it cleaner", with the Skill tool, calling `mattpocock-skills:grilling` on those parts alone. Keep it short, with as many questions as those parts need, and end the grill once each part maps to a concrete change. Skip this step when every part already does.

5. Size the changes against Pocock's `to-tickets` rule, that a slice fits in a single fresh context window. When the changes together exceed one session, name the changes and stop without edits. Done when the changes are judged to fit, or the flow has stopped.

6. State the split in chat as one table with the columns Change, Kind and Citation. Kind is **code change** or **requirement change**, and Citation is the spec line or standard from step 3, or `none`. When every change is a code change, go on without asking. When any change is a requirement change, name its spec source, which is the pull request's spec when it implements one (the issue its tickets name as their parent), else its ticket, else the one issue its body closes. When that spec source is the pull request body, stop without edits, since this flow edits the spec source only when it is an issue. Otherwise ask the user once whether to edit that spec source and build every change in the table, go on when they confirm, and stop without edits when they decline. Done when the table is in chat and the flow has gone on or stopped.

7. Edit the spec source for the requirement changes before any code changes, so the review loop checks the code against the new spec text. Skip this step when every change is a code change. Read the body with `gh issue view <N> --json body --jq .body`, rewrite in place each line a requirement change rewords or contradicts, and add each line a requirement change adds, under the heading it belongs to, so the body reads as the current requirement. Write the new body to a temporary file outside the repo and run `gh issue edit <N> --body-file <file>`. Then write one line, `Edited by rflow:tweak-pr in #<pull request number>.`, to another temporary file and run `gh issue comment <N> --body-file <file>`. Done when `gh issue view <N>` shows every requirement change in the body and that one comment.

8. Build the changes, code changes and requirement changes alike. For each change that alters behaviour, call the Skill tool with `mattpocock-skills:tdd` at pre-agreed seams, and run typechecking and the affected test file after each red-green cycle. Make each change that alters no behaviour, such as prose, a rename or formatting, as a direct edit. Commit each change once the full test suite passes, with a subject and body that describe the change itself, as if it had always been part of the pull request, so the `ref` lines stay as step 1 printed them. Code comments read the same way, and the pull request body stays as it is, so the comment from step 7 is the only trace of the tweak. Done when every change in the table is committed, every behaviour change has a passing test, and the full test suite passes.

9. Read `${CLAUDE_PLUGIN_ROOT}/references/review-loop.md` and follow it, with the `base` branch and the `ref` lines from step 1. The loop reviews the whole pull request against its base and against the spec source as step 7 left it.

10. Call the Skill tool with `rflow:finish` to push the branch to the pull request.
