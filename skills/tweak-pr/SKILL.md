---
name: tweak-pr
description: Change an open GitHub pull request on its own branch as your guidance asks, editing its spec issue for a requirement change once you confirm, then review it until nothing blocks and push it with rflow:finish.
argument-hint: <pull request number or URL> <guidance>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md (the build), skills/engineering/code-review/SKILL.md (its two sub-agents, given a brief that splits the guidance) and skills/engineering/wayfinder/SKILL.md (updating the tickets a decision invalidates, applied to the spec sources) at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree on the pull request's own branch, the split of the guidance into cited changes, the in-place edit of the spec sources for a requirement change, the one-session limit, a bounded review loop in place of the single review, and the hand-off to rflow:finish. -->

# Tweak PR

`$ARGUMENTS` holds the pull request, a number or URL, as its first word and the **guidance** as the rest. Ask for whichever is missing. The guidance reaches skills and sub-agents as prompt text, and reaches a shell command only through a file. The pull request reaches a shell command as its number, digits only, taken from the `/pull/<number>` part when it is a URL. Stopping without edits means telling the user why and that `/rflow:finish` removes the worktree.

1. Open a worktree on the pull request's own branch.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open head '<number>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree, and keep its `base` and `ref` lines. The `base` branch is the fixed point for every review in this flow. When `open`, EnterWorktree or status fails, report the message and stop. Done when the session is in the printed worktree and `status` has printed `base`.

2. Collect the **spec sources**. Run `gh pr view '<number>' --json url,closingIssuesReferences --jq '.url, (.closingIssuesReferences[] | "\(.repository.owner.login)/\(.repository.name) \(.number)")'`, which prints the pull request URL, kept for step 7, then one `<owner>/<name> <issue>` line per issue it closes. The spec sources are each issue in the `ref` lines from step 1, read with `gh issue view '<issue>' --json title,body`, and each issue it closes, read the same way with `--repo '<owner>/<name>'` added. Every issue number and owner and name reaches the shell cut down to letters, digits and `.-_`. When there are no `ref` lines and no closed issues, the pull request body is the spec source, read with `gh pr view '<number>' --json body`. Done when every spec source is read.

3. Split the guidance into **changes**. Call the Skill tool with `mattpocock-skills:code-review`, passing the `base` branch as the fixed point, the spec sources from step 2 and the guidance. Tell it that this brief replaces both of its sub-agent briefs: "Split the guidance into separate changes, one per thing it asks for. Begin each change with the words of the guidance it comes from, in quotes, and return it with the line it rests on, or `none`. The Spec sub-agent cites a spec source line and marks each change a code change when it leaves the spec sources as they are, or a requirement change when it rewords, contradicts or adds to what a spec source asks for. The Standards sub-agent cites a documented standard, file and rule. Under 400 words." Tell both sub-agents to read the code themselves, without calling skills or starting agents of their own. Tell code-review too that step 6 of this flow joins its two reports into one table, in place of its rule to keep the axes apart. Done when both reports are in.

4. Settle each part of the guidance that maps to no concrete change, such as "make it cleaner", with the Skill tool, calling `mattpocock-skills:grilling` on those parts alone. Keep it short, with as many questions as those parts need, and end the grill once each part maps to a concrete change. Give each change the grill settles a kind and a citation by step 3's rule. Done when every part of the guidance maps to a change with a kind.

5. Size the changes against Pocock's `to-tickets` rule. The changes fit when `to-tickets` would make them one ticket, one vertical slice that is verifiable on its own and that a single fresh context window could build and review. When they do not fit, name the changes and stop without edits. Done when the changes fit or the flow has stopped.

6. State the split in chat as one table with the columns Change, Kind, Citation and Seam. Join the two reports from step 3 on the quoted guidance words, adding the changes from step 4. Kind is **code change** or **requirement change**, taken from the Spec report. Citation is the spec line or standard the change rests on, kept only after you open the cited spec source or standards file and find that line, and `none` otherwise. Seam is where `tdd` tests a change that alters behaviour, and `none` for a change that alters no behaviour. Then take the first branch that applies.

   - **No single issue to edit.** A requirement change rests on the pull request body, or step 1 printed no `ref` lines and the pull request closes more than one issue. Stop without edits, since this flow edits a spec source only when one issue holds the requirement.
   - **Nothing to confirm.** Every change is a code change and every seam is `none` or one that a spec source's Testing Decisions name. Go on without asking.
   - **Confirm.** For each requirement change, show each spec source line it touches as it reads now and as it will read, in the spec and in every ticket that states the same requirement. List each seam that no Testing Decisions name. Ask the user once to confirm those edits, those seams and building every change in the table. Go on when they confirm, and stop without edits when they decline.

   Done when the table is in chat and the flow has gone on or stopped.

7. Edit the spec sources for the requirement changes before any code changes, so the review loop checks the code against the new text. Skip this step when every change is a code change. For each issue step 6 showed, read the body with `gh issue view '<issue>' --json body --jq .body`, write in place exactly the lines step 6 showed, under the heading each belongs to, so the body reads as the current requirement. Write the new body to a temporary file outside the repo and run `gh issue edit '<issue>' --body-file <file>`. Then write one line, `Edited by rflow:tweak-pr in <pull request URL>.`, to another temporary file and run `gh issue comment '<issue>' --body-file <file>`. Each command adds the `--repo` that step 2 used for that issue. Done when each edited issue shows the lines step 6 showed and that one comment, and no spec source contradicts another.

8. Build the changes, code changes and requirement changes alike. For each change that alters behaviour, call the Skill tool with `mattpocock-skills:tdd` at the seam from the table, and run typechecking and the affected test file after each red-green cycle. Make each change that alters no behaviour, such as prose, a rename or formatting, as a direct edit. Commit each change once the full test suite passes, with a subject and body that describe the change itself, as if it had always been part of the pull request, so the `ref` lines stay as step 1 printed them. Code comments read the same way, and the pull request body stays as it is, so the comment from step 7 is the only trace of the tweak. Done when every change in the table is committed, every behaviour change has a passing test, and the full test suite passes.

9. Read `${CLAUDE_PLUGIN_ROOT}/references/review-loop.md` and follow it, with the `base` branch from step 1 and the spec sources from step 2, read again after step 7, in place of the `ref` lines. The loop reviews the whole pull request against its base. Done when the loop ends.

10. Call the Skill tool with `rflow:finish` to push the branch to the pull request. Done when `rflow:finish` reports the pull request URL, or has stopped on a failed check with the worktree kept.
