---
name: implement-spec
description: Implement a spec's tickets in parallel subagents on one integration worktree, review it until nothing blocks, then finish with a pull request or local merge.
argument-hint: <spec issue number, URL or file>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement-spec/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree, the merge trailers and a bounded review loop in place of the single closing review, and rflow:finish takes over the draft pull request and resolving the tickets. -->

# Implement spec

The spec reference is `$ARGUMENTS`. Ask for one if it is empty. The spec has tickets associated with it, describing how to implement it.

The goal is the entire spec implemented on a single **integration branch**, which is the branch of the worktree this skill opens.

The tickets form a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Keep each message to and from subagents under 10 lines. Communicate through **context pointers** to the spec, tickets, research notes and previous commits, and leave out what those pointers already hold.

Run one **implementer subagent** per frontier ticket, in the background.

## Steps

1. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" sync`. It fast-forwards the default branch and checks that `/rflow:setup` has run. When it fails, report its message and stop.

2. Read `docs/agents/issue-tracker.md`, and read the spec and tickets through it to understand the task graph.

3. Open the worktree.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open feat '<spec title>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Its branch is the integration branch.

4. When several tickets need the same exploration of codebase files or external documentation, give it to an **exploration subagent**. It saves its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

5. Use **implementer subagents** (the Agent tool with `isolation: "worktree"`) to implement each frontier ticket, each in its own worktree on its own branch. Each implementer subagent
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `mattpocock-skills:tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done.

6. Once an **implementer subagent** completes, merge its work into the integration branch with a **merger subagent**, working in the integration worktree. It merges with `git merge --no-ff` and gives the merge commit two trailers, `Ticket: <ticket ref>` and `Spec: <spec ref>`, which is how `rflow:finish` knows what to resolve.

7. When this changes the **frontier**, start an implementer subagent for each new frontier ticket.

8. Once all tickets are merged, clean up all **implementer subagent** worktrees and branches.

9. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status` for the `base` branch and the `ref` lines. Then read `${CLAUDE_PLUGIN_ROOT}/references/review-loop.md` and follow it, giving each round's fixes to one **implementer subagent** working in the integration worktree.

10. Call the Skill tool with `rflow:finish` to ship the integration branch.
