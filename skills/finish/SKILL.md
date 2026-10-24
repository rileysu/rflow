---
name: finish
description: Ship the current rflow worktree as a pull request or local merge, then remove it. Use when an rflow flow's work is committed and ready to ship.
---

# Finish

The branch ships as a **pull request** or a **local merge**, chosen by the issue tracker, and its worktree is removed once it ships. A pull request's branch stays on the remote, where later review comments land.

## 1. Locate

Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`. It prints the `base` branch, the `main_checkout` path, the `branch`, the count of `commits` on the branch beyond the base and one `ref` line per ticket or spec the branch implemented. When it fails, report its message and stop.

Uncommitted changes block the rest. Show them and ask whether to commit them or stop.

## 2. Ship

When `commits=0`, the branch has nothing to ship, so go straight to Clean up with no pull request and no merge.

Read `docs/agents/issue-tracker.md` in the worktree. GitHub ships as a pull request and local markdown as a local merge. For any other tracker, stop and report that rflow supports GitHub and local markdown.

### Pull request (GitHub)

1. Push with `git push -u origin <branch>` when the branch has no upstream or has commits its upstream lacks.
2. When the branch has no pull request yet, write its body with the Skill tool, calling `mattpocock-skills:pr`, and end it with one `Closes <ref>` line per `ref`. Save the body to a file outside the repo and run `gh pr create --base <base> --title <title> --body-file <file>`.
3. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" checks` in the background and wait for it to exit. When a check fails, report it and stop with the worktree kept, so the fix lands on the same branch. The user runs `/rflow:finish` again after the fix.

### Local merge (local markdown)

1. In each `ref` file, replace the status line (`**Status:** …` or `Status: …`) with `**Status:** resolved`, or add that line under the title when the file has none, and commit.
2. When `<base>` has commits the branch lacks (`git log HEAD..<base>` lists any), merge `<base>` into the branch here in the worktree, resolve any conflicts, rerun the tests and commit.
3. Confirm with the user. Call ExitWorktree with `action: "keep"` when this session entered the worktree with EnterWorktree, because Claude Code blocks git aimed at the main checkout from inside a worktree. Then run `git merge --no-ff <branch>` in `<main_checkout>`.

## 3. Clean up

1. Call ExitWorktree with `action: "keep"` when this session is still in the worktree it entered with EnterWorktree.
2. From `<main_checkout>`, run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close <branch>`. When it fails, report its message.

## 4. Report

Report the pull request URL, the merge commit or that the branch had no commits to ship, and the removed worktree. When the branch was a `docs/` branch, name the next step for each ticket or spec published in this conversation, `/rflow:implement-ticket <ticket>` for a ticket without a spec, or `/rflow:implement-spec <spec>` for a spec.
