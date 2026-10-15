---
name: finish
description: Review, ship and remove the current rflow worktree. Use when an rflow flow's work is done, or the user says finish.
---

# Finish

The branch ships as a **pull request** or a **local merge**, chosen by the issue tracker. Its worktree is removed once checks pass, before the merge. The branch stays on the remote, and `/rflow:review-pr` reopens it for later changes.

## 1. Locate

Run `"${CLAUDE_PLUGIN_ROOT}/scripts/context.sh"` for the `base` branch and the `main_checkout` path, and `git branch --show-current` for the branch. The session must be on a branch in a worktree under `../.worktrees/`. Otherwise stop and report that there is nothing to finish.

Uncommitted changes block the rest. Show them and ask whether to commit them or stop.

## 2. Review

Run this step before the branch's first pull request or local merge. A rerun after a failed check starts at step 3.

Call the Skill tool with `mattpocock-skills:code-review`, using `<base>` as the fixed point. Show the report, fix its findings, and commit the fixes.

## 3. Collect references

Tickets and specs this branch implemented are recorded as commit trailers.

```sh
git log <base>..HEAD --format='%(trailers:key=Ticket,valueonly)%(trailers:key=Spec,valueonly)' | sort -u
```

A branch with no trailers, such as a docs branch, resolves nothing.

## 4. Ship

Read `docs/agents/issue-tracker.md`. GitHub ships as a pull request and local markdown as a local merge. For any other tracker, stop and report that rflow supports GitHub and local markdown.

### Pull request (GitHub)

1. Push with `git push -u origin <branch>` when the branch has no upstream or has commits its upstream lacks.
2. When the branch has no pull request yet, open one against `<base>` with `gh pr create`. Write the body with the Skill tool, calling `mattpocock-skills:pr`, and end it with one `Closes <ref>` line per collected reference.
3. Wait for checks with `gh pr checks --watch`. A branch with no checks reported passes. When a check fails, report it and stop with the worktree kept, so the fix lands on the same branch. The user runs `/rflow:finish` again after the fix.

### Local merge (local markdown)

1. Set the `Status:` line of each collected ticket or spec file to `Status: resolved`, adding the line under the title when the file has none, and commit.
2. Confirm with the user, then run `git -C <main_checkout> merge --no-ff <branch>`.

## 5. Clean up

1. If this session entered the worktree with EnterWorktree, call ExitWorktree with `action: "keep"`.
2. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/close-worktree.sh" branch <branch>`. It removes the worktree and the local branch, and refuses when the branch holds commits that exist nowhere else.

## 6. Report

Report the pull request URL or the merge commit, and the removed worktree. When the branch was a `docs/` branch whose tickets or spec were just published, name the next step, `/rflow:implement-ticket <ref>` for each ticket or a spec without tickets, or `/rflow:implement-spec <ref>` for a spec with tickets.
