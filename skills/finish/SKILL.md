---
name: finish
description: Ship and clean up the current rflow worktree, opening a pull request or merging locally, resolving its tickets, then removing the worktree. Use when an rflow flow's work is done, or the user says finish.
---

# Finish

Close the rflow worktree this session is in. The branch either ships as a **pull request** or **merges locally**, per the issue tracker, and then the worktree is removed.

## 1. Locate

The session must be inside a worktree under `../.worktrees/`. If it is not, stop and say there is nothing to finish.

Record the branch (`git branch --show-current`) and the base ref (`git symbolic-ref --short refs/remotes/origin/HEAD`, or the main checkout's branch when there is no `origin`).

Uncommitted changes block the rest. Show them and ask whether to commit them or stop.

## 2. Collect references

Tickets and specs this branch implemented are recorded as commit trailers:

```sh
git log <base>..HEAD --format='%(trailers:key=Ticket,valueonly)%(trailers:key=Spec,valueonly)' | sort -u
```

A branch with no trailers (a docs branch, a reviewed pull request) implemented nothing and resolves nothing.

## 3. Ship

Read `docs/agents/issue-tracker.md` and take the branch for its tracker. For any other tracker, ask the user which branch applies.

### GitHub or GitLab: pull request

1. Push with `git push -u origin <branch>` when the branch has commits its upstream lacks, or has no upstream.
2. Open a pull request (`gh pr create`, or `glab mr create` on GitLab) against the base unless one already exists for the branch. Write the body with the Skill tool, calling `mattpocock-skills:pr`, and end it with one `Closes <ref>` line per collected reference.
3. When this run pushed, wait for checks with `gh pr checks --watch` (on GitLab, wait for the merge request pipeline). If a check fails, stop here: report the failure and keep the worktree, so the fix lands on the same branch. The user runs `/rflow:finish` again after fixing.

### Local markdown: local merge

1. Set the `Status:` line of each collected ticket file to `Status: resolved` and commit.
2. Leave the worktree (step 4's ExitWorktree), confirm with the user, then run `git merge --no-ff <branch>` in the main checkout, which sits on the base branch.

## 4. Clean up

1. If the session is still in the worktree, call ExitWorktree with `action: "keep"` to return to the main checkout.
2. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/close-worktree.sh" <branch>`. It removes the worktree and deletes the local branch, and refuses when the branch holds commits that exist nowhere else.

## 5. Report

Report the pull request URL or the merge commit, and the removed worktree. When the branch was a `docs/` branch whose spec or tickets were just published, name the next step: `/rflow:implement-ticket <ref>` for one ticket, or `/rflow:implement-spec <ref>` for a spec with tickets.
