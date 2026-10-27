---
name: tweak-pr
description: Change an open GitHub pull request on its own branch as the guidance asks, editing its spec issue once the user confirms, then review it and push it with rflow:finish.
argument-hint: <pull request number or URL> <guidance>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md (the build), skills/engineering/code-review/SKILL.md (its sub-agents, briefed to split the guidance) and skills/engineering/wayfinder/SKILL.md (updating what a decision invalidates) at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree on the pull request's branch, the in-place spec edits, the one-session limit, a bounded review loop and the hand-off to rflow:finish. -->

# Tweak PR

`$ARGUMENTS` holds the pull request, a number or URL, as its first word and the **guidance** as the rest. Ask for whichever is missing. The pull request reaches the shell as its number, digits only. Stopping without edits means telling the user why, calling ExitWorktree with `action: "keep"`, and running `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close '<branch>'` from the main checkout with the `branch` line from step 1.

1. Open a worktree on the pull request's own branch.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open head '<number>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree, and keep its `base` and `branch` lines. When `open` or either step fails, report the message and stop. Done when the session is in the printed worktree and `status` has printed `base`.

2. Collect the **spec sources**. Read the pull request with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" view '<number>'`, and keep its `url` for step 7. Each issue in its `closingIssuesReferences` is a spec source. Read one whose `owner` and `repo` match the `url` with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" view '<issue>'`. Read one from another repo with `gh issue view '<issue>' --repo '<owner>/<repo>' --json title,body`, with the issue, owner and repo each cut down to letters, digits and `.-_`, and give every later `gh issue` command on it the same `--repo`. When it closes none, the pull request's `body` is the spec source. Done when every spec source is read.

3. Split the guidance into **changes**. Call the Skill tool with `mattpocock-skills:code-review`, passing the `base` branch as the fixed point, the spec sources and the guidance, and tell it this brief replaces both of its sub-agent briefs: "Split the guidance into separate changes, one per thing it asks for. Begin each change with the words of the guidance it comes from, in quotes, and return it with the line it rests on, or `none`. The Spec sub-agent cites a spec source line and marks each change a code change when it leaves the spec sources as they are, or a requirement change when it rewords, contradicts or adds to what a spec source asks for, and names each `GLOSSARY.md` term a change renames or redefines and each ADR in `docs/adr/` it reverses. The Standards sub-agent cites a documented standard, file and rule. Under 400 words." Tell both sub-agents to read the code themselves, without calling skills or starting agents of their own. Done when both reports are in.

4. Settle each part of the guidance that maps to no concrete change, such as "make it cleaner", by calling the Skill tool with `mattpocock-skills:grilling` on those parts alone, keeping it short. Give each change the grill settles a kind and a citation by step 3's rule. Done when every part of the guidance maps to a change with a kind.

5. When the changes would not make one `to-tickets` ticket, a vertical slice that one fresh context window could build and review, name them and stop without edits. Done when the changes fit or the flow has stopped.

6. State the split in chat as one table with the columns Change, Kind, Citation and Seam, joining the two reports on the quoted guidance words and keeping the Spec report's split and kinds. Seam is where `tdd` tests a change that alters behaviour, and `none` for one that alters none. Then take the first branch that applies.

   - **Body only.** The pull request closes no issue and a change is a requirement change. Stop without edits, since no issue holds the requirement.
   - **Nothing to confirm.** Every change is a code change, the Spec report names no glossary term or ADR, and every seam is `none` or named by a spec source's Testing Decisions. Go on without asking.
   - **Confirm.** Show each line a requirement change touches as it reads now and as it will read, in each spec source and in any parent spec or sibling ticket that states the same requirement, found by reading the spec source's `parent`, and that parent's `subIssues`, with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" view '<issue>'`. For each glossary term or ADR the Spec report names, call the Skill tool with `mattpocock-skills:domain-modeling` and show its edit. List each seam no Testing Decisions name. Ask the user once to confirm those edits, those seams and building every change in the table. When they decline, discard the worktree's uncommitted edits and new files, so `git status` shows a clean worktree, and stop without edits.

   Done when the table is in chat and the flow has gone on or stopped.

7. Write the edits step 6 showed before any code changes, so `tdd` and the review loop work from the new text.
   - For each issue, edit only the lines step 6 showed, leaving the rest of its body as it is, write the new body and the line `Edited by rflow:tweak-pr in <pull request URL>.` to two temporary files outside the repo, then run `gh issue edit '<issue>' --body-file <body file>` and `gh issue comment '<issue>' --body-file <comment file>`.
   - Commit the glossary and ADR edits in one commit that describes the new term or decision.

   Done when each edited issue shows the lines step 6 showed and that one comment, the glossary and ADR edits are committed, and no spec source contradicts another.

8. Build every change in the table.
   - For each change that alters behaviour, call the Skill tool with `mattpocock-skills:tdd` at the seam from the table, telling it the seam is pre-agreed. Run typechecking and the affected test file after each red-green cycle.
   - Make each change that alters no behaviour, such as prose, a rename or formatting, as a direct edit.
   - Commit each change once the full test suite passes, with a message that describes the change as if it had always been part of the pull request. Code comments read the same way.

   Done when every change in the table is committed, every behaviour change has a passing test, and the full test suite passes.

9. Read `${CLAUDE_PLUGIN_ROOT}/references/review-loop.md` and follow it, with the `base` branch from step 1 and the spec sources from step 2, read again after step 7, in place of the `ref` lines. Done when the loop ends.

10. Call the Skill tool with `rflow:finish` to push the branch to the pull request. Done when `rflow:finish` reports the pull request URL, or has stopped on a failed check with the worktree kept.
