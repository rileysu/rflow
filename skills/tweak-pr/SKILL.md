---
name: tweak-pr
description: Change an open GitHub pull request on its own branch as the guidance asks, editing its spec issue for a requirement change once the user confirms, then review it until nothing blocks and push it with rflow:finish.
argument-hint: <pull request number or URL> <guidance>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md (the build), skills/engineering/code-review/SKILL.md (its two sub-agents, given a brief that splits the guidance) and skills/engineering/wayfinder/SKILL.md (updating the tickets a decision invalidates, applied to the spec sources) at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree on the pull request's own branch, the split of the guidance into cited changes, the in-place edit of the spec sources for a requirement change, the glossary and ADR edits committed before the code, the one-session limit, a bounded review loop in place of the single review, and the hand-off to rflow:finish. -->

# Tweak PR

`$ARGUMENTS` holds the pull request, a number or URL, as its first word and the **guidance** as the rest. Ask for whichever is missing. The guidance reaches skills and sub-agents as prompt text, and a shell command only through a file. The pull request reaches a shell command as its number, digits only, taken from the `/pull/<number>` part of a URL. Stopping without edits means telling the user why, calling ExitWorktree with `action: "keep"`, and running `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close '<branch>'` from the main checkout with the `branch` line from step 1, cut down to letters, digits and `./-_`, relaying any refusal as it is.

1. Open a worktree on the pull request's own branch.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open head '<number>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree, and keep its `base`, `branch` and `ref` lines. When `open`, EnterWorktree or status fails, report the message and stop. Done when the session is in the printed worktree and `status` has printed `base`.

2. Collect the **spec sources**, reading each issue once with `gh issue view '<issue>' --json title,body`. Every issue number and owner and name reaches the shell cut down to letters, digits and `.-_`.
   - Run `gh pr view '<number>' --json url,closingIssuesReferences --jq '.url, (.closingIssuesReferences[] | "\(.repository.owner.login)/\(.repository.name) \(.number)")'`. It prints the pull request URL, kept for step 7, then one `<owner>/<name> <issue>` line per issue the pull request closes.
   - Read each issue it closes with `--repo '<owner>/<name>'` added.
   - Read each issue in the `ref` lines from step 1 that the closed issues leave out.
   - When there are no `ref` lines and no closed issues, read the pull request body with `gh pr view '<number>' --json body`, and that body is the spec source.

   Done when every spec source is read.

3. Split the guidance into **changes**. Call the Skill tool with `mattpocock-skills:code-review`, passing the `base` branch as the fixed point, the spec sources from step 2 and the guidance. Tell it that this brief replaces both of its sub-agent briefs: "Split the guidance into separate changes, one per thing it asks for. Begin each change with the words of the guidance it comes from, in quotes, and return it with the line it rests on, or `none`. The Spec sub-agent cites a spec source line and marks each change a code change when it leaves the spec sources as they are, or a requirement change when it rewords, contradicts or adds to what a spec source asks for. It also reads `GLOSSARY.md` and `docs/adr/`, and names each glossary term a change renames or redefines and each ADR a change reverses. The Standards sub-agent cites a documented standard, file and rule. Under 400 words." Tell both sub-agents to read the code themselves, without calling skills or starting agents of their own. Tell code-review too that step 6 joins its two reports, in place of its rule to keep them apart. Done when both reports are in.

4. Settle each part of the guidance that maps to no concrete change, such as "make it cleaner", by calling the Skill tool with `mattpocock-skills:grilling` on those parts alone, keeping it short. Give each change the grill settles a kind and a citation by step 3's rule. Done when every part of the guidance maps to a change with a kind.

5. Size the changes. They fit when Pocock's `to-tickets` would make them one ticket, a vertical slice verifiable on its own that a single fresh context window could build and review. When they do not fit, name the changes and stop without edits. Done when the changes fit or the flow has stopped.

6. State the split in chat as one table with the columns Change, Kind, Citation and Seam. Join the two reports from step 3 on the quoted guidance words, adding the changes from step 4. When the reports split the guidance differently, keep the Spec report's split and attach each Standards citation to the change whose quoted words contain it. Kind is **code change** or **requirement change**, taken from the Spec report, and code change for every change when there is no Spec report. Citation is the spec line or standard the change rests on, kept only after you open the cited spec source or standards file and find that line, and `none` otherwise. Seam is where `tdd` tests a change that alters behaviour, and `none` for a change that alters no behaviour. Then take the first branch that applies.

   - **No single issue to edit.** A requirement change rests on the pull request body, or step 1 printed no `ref` lines and the pull request closes more than one issue. Stop without edits, since the flow cannot tell which issue holds the requirement.
   - **Nothing to confirm.** Every change is a code change, the Spec report names no glossary term or ADR, and every seam is `none` or one that the Testing Decisions of a spec source or its parent name. Go on without asking.
   - **Confirm.** For each requirement change, show each line it touches as it reads now and as it will read, in each spec source, and in each spec source's parent issue and that parent's other sub-issues when they state the same requirement, read with `gh issue view '<issue>' --json parent,subIssues`. The parent and its sub-issues take the edit and stay out of the review loop. For each glossary term or ADR the Spec report names, call the Skill tool with `mattpocock-skills:domain-modeling`, and show the `GLOSSARY.md` entry as it reads now and as it will read, or the new ADR and the status line that marks the old one superseded, keeping that wording in chat until step 7 writes it. List each seam that no Testing Decisions name. Ask the user once to confirm those edits, those seams and building every change in the table. Go on when they confirm. When they decline, undo any file `domain-modeling` wrote, so `git status` shows a clean worktree, then stop without edits.

   Done when the table is in chat and the flow has gone on or stopped.

7. Write the edits step 6 showed before any code changes, so `tdd` and the review loop work from the new text. Each `gh` command adds the `--repo` that step 2 used for that issue.
   - For each issue step 6 showed, read the body with `gh issue view '<issue>' --json body --jq .body`, and write in place exactly the lines step 6 showed, under the heading each belongs to, so the body reads as the current requirement.
   - Write the new body and the line `Edited by rflow:tweak-pr in <pull request URL>.` to two temporary files outside the repo, then run `gh issue edit '<issue>' --body-file <body file>` and `gh issue comment '<issue>' --body-file <comment file>`.
   - Write exactly the `GLOSSARY.md` and ADR lines step 6 showed, and commit them in one commit that describes the new term or decision.

   Done when each edited issue shows the lines step 6 showed and that one comment, the glossary and ADR lines step 6 showed are committed, and no spec source contradicts another.

8. Build every change in the table.
   - For each change that alters behaviour, call the Skill tool with `mattpocock-skills:tdd` at the seam from the table, telling it the seam is pre-agreed. Run typechecking and the affected test file after each red-green cycle.
   - Make each change that alters no behaviour, such as prose, a rename or formatting, as a direct edit.
   - Commit each change once the full test suite passes, with a subject and body that describe the change itself, as if it had always been part of the pull request, so the `ref` lines stay as step 1 printed them. Code comments read the same way.
   - Leave the pull request body as it is, so step 7's comment is the only trace of the tweak.

   Done when every change in the table is committed, every behaviour change has a passing test, and the full test suite passes.

9. Read `${CLAUDE_PLUGIN_ROOT}/references/review-loop.md` and follow it, with the `base` branch from step 1 and the spec sources from step 2, read again after step 7, in place of the `ref` lines. Done when the loop ends.

10. Call the Skill tool with `rflow:finish` to push the branch to the pull request. Done when `rflow:finish` reports the pull request URL, or has stopped on a failed check with the worktree kept.
