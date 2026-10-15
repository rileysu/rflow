---
name: finish
description: Review, ship and remove the current rflow worktree. Use when an rflow flow's work is committed and ready to ship.
---

# Finish

The branch ships as a **pull request** or a **local merge**, chosen by the issue tracker, and its worktree is removed once it ships. A pull request's branch stays on the remote, where later review comments land.

## 1. Locate

Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`. It prints the `base` branch, the `main_checkout` path, the `branch`, the `worktree` and one `ref` line per ticket or spec the branch implemented. When it fails, report its message and stop.

Uncommitted changes block the rest. Show them and ask whether to commit them or stop.

## 2. Review

Skip this step when the branch already has a pull request.

Call the Skill tool with `mattpocock-skills:code-review`, using `<base>` as the fixed point and the `ref` lines as spec sources. Show the report, fix its findings, and commit the fixes.

## 3. Ship

Read `docs/agents/issue-tracker.md`. GitHub ships as a pull request and local markdown as a local merge. For any other tracker, stop and report that rflow supports GitHub and local markdown.

### Pull request (GitHub)

1. Push with `git push -u origin <branch>` when the branch has no upstream or has commits its upstream lacks.
2. When the branch has no pull request yet, open one against `<base>` with `gh pr create`. Write the body with the Skill tool, calling `mattpocock-skills:pr`, and end it with one `Closes <ref>` line per `ref`.
3. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" checks` in the background and wait for it to exit, which takes as long as CI does. It passes a branch with no checks. When a check fails, report it and stop with the worktree kept, so the fix lands on the same branch. The user runs `/rflow:finish` again after the fix.

### Local merge (local markdown)

1. In each `ref` file, replace the status line (`**Status:** …` or `Status: …`) with `**Status:** resolved`, or add that line under the title when the file has none, and commit.
2. Confirm with the user. Call ExitWorktree with `action: "keep"` when this session entered the worktree with EnterWorktree, because Claude Code blocks git aimed at the main checkout from inside a worktree. Then run `git merge --no-ff <branch>` in `<main_checkout>`. When the merge stops on conflicts, run `git merge --abort` and report them.

## 4. Clean up

1. Call ExitWorktree with `action: "keep"` when this session is still in the worktree it entered with EnterWorktree.
2. From `<main_checkout>`, run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close <branch>`. It removes the worktree and the local branch, and refuses when the branch holds commits that exist nowhere else.

## 5. Report

Report the pull request URL or the merge commit, and the removed worktree. When the branch was a `docs/` branch whose tickets were just published, name the next step, `/rflow:implement-ticket <ref>` for each ticket without a spec, or `/rflow:implement-spec <ref>` for a spec.
