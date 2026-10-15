---
name: review-pr
description: Review a GitHub pull request in a worktree on its head branch, optionally post the review, then clean up.
disable-model-invocation: true
---

# Review PR

Run from the main checkout. The pull request number or URL is the skill's arguments; ask for one if they are empty.

1. Open a worktree on the pull request's head branch:

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" --pr <number-or-url>
   ```

   Call EnterWorktree with `path` set to the printed path.

2. Read the pull request with `gh pr view <number-or-url> --json baseRefName,body`. The fixed point is `origin/<baseRefName>`. Issues the body references (`Closes #N`) are spec sources alongside the commit messages.

3. Call the Skill tool with `mattpocock-skills:code-review`, passing the fixed point and any spec sources from step 2. Report its findings in chat.

4. Ask whether to post the review on the pull request. On yes, write the report to a temporary file outside the repo and run `gh pr review <number-or-url> --comment --body-file <file>`.

5. Call the Skill tool with `rflow:finish`. With no new commits and an existing pull request, it only cleans up.
