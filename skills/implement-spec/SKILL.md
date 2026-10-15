---
name: implement-spec
description: Implement a spec's tickets in parallel subagents on one integration worktree, then finish with a pull request or local merge.
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement-spec/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. -->

# Implement spec

Run from the main checkout. The spec reference is the skill's arguments. The spec should have tickets associated with it, describing how to implement it.

The goal is the entire spec implemented on a single **integration branch**: the branch of the worktree this skill opens.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets from the issue tracker (`docs/agents/issue-tracker.md`) to understand the task graph.

2. Open the worktree on `feat/<slug>`, where `<slug>` is a kebab-case slug of the spec title in at most 5 words:

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" feat/<slug>
   ```

   Call EnterWorktree with `path` set to the printed path. Its branch is the integration branch.

3. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. It saves its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

4. Use **implementer subagents** (the Agent tool with `isolation: "worktree"`) to implement each frontier ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `mattpocock-skills:tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done.

5. Once an **implementer subagent** completes, merge its work into the integration branch with a **merger subagent**, working in the integration worktree. It merges with `git merge --no-ff` and gives the merge commit two trailers, `Ticket: <ticket ref>` and `Spec: <spec ref>`, which is how `rflow:finish` knows what to resolve.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are merged, call the Skill tool with `mattpocock-skills:code-review` on the integration branch, using the base ref as the fixed point. Fix all issues raised by the code review in a single **implementer subagent**, merged the same way with the `Spec:` trailer.

8. Clean up all **implementer subagent** worktrees and branches.

9. Call the Skill tool with `rflow:finish`.
