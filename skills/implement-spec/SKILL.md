---
name: implement-spec
description: Implement a spec's tickets in parallel subagents on one integration worktree, then finish with a pull request or local merge.
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement-spec/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. -->

# Implement spec

The spec reference is the skill's arguments. The spec has tickets associated with it, describing how to implement it.

The goal is the entire spec implemented on a single **integration branch**, which is the branch of the worktree this skill opens.

The tickets form a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Keep each message to and from subagents under 10 lines. Communicate through **context pointers** to the spec, tickets, research notes and previous commits, and leave out what those pointers already hold.

Run one **implementer subagent** per frontier ticket, in the background.

## Steps

1. Read `docs/agents/issue-tracker.md`. When it is missing, tell the user to run `/rflow:setup` and stop. Read the spec and tickets through it to understand the task graph.

2. Open the worktree on `feat/<slug>`, where `<slug>` is a kebab-case slug of the spec title in at most 5 words.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" branch feat/<slug>
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Its branch is the integration branch.

3. (optional) Use an **exploration subagent** to conduct the exploration the tickets require, in relevant codebase files or external documentation. It saves its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

4. Use **implementer subagents** (the Agent tool with `isolation: "worktree"`) to implement each frontier ticket, each in its own worktree on its own branch. Each implementer subagent
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `mattpocock-skills:tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done.

5. Once an **implementer subagent** completes, merge its work into the integration branch with a **merger subagent**, working in the integration worktree. It merges with `git merge --no-ff` and gives the merge commit two trailers, `Ticket: <ticket ref>` and `Spec: <spec ref>`, which is how `rflow:finish` knows what to resolve.

6. When this changes the **frontier**, start an implementer subagent for each new frontier ticket.

7. Once all tickets are merged, clean up all **implementer subagent** worktrees and branches.

8. Call the Skill tool with `rflow:finish`. It reviews the integration branch before shipping.
