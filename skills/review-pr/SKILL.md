---
name: review-pr
description: Review a GitHub pull request in a detached worktree, optionally post the review, then remove the worktree.
argument-hint: <pull request number or URL>
disable-model-invocation: true
---

# Review PR

The pull request is `$ARGUMENTS`, a number or URL. Ask for one if it is empty.

1. Open a detached worktree at the pull request's head.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open pr <number-or-url>
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

2. Read the pull request with `gh pr view <number-or-url> --json number,baseRefName,body`, and run `git fetch origin <baseRefName>`. The fixed point is `origin/<baseRefName>`. Issues the body references (`Closes #N`) are spec sources alongside the commit messages.

3. Call the Skill tool with `mattpocock-skills:code-review`, passing the fixed point and any spec sources from step 2. Report its findings in chat.

4. Ask whether to post the review on the pull request. On yes, write the report to a temporary file outside the repo and run `gh pr review <number> --comment --body-file <file>`.

5. Call ExitWorktree with `action: "keep"` when this session entered the worktree with EnterWorktree. Then, from the main checkout, run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close pr <number>`.
