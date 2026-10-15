---
name: implement-ticket
description: Implement one ticket in a worktree in this session, then finish with a pull request or local merge.
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. -->

# Implement ticket

Run from the main checkout. The ticket reference is the skill's arguments: an issue number or URL, or a ticket file path for a local tracker.

1. Fetch the ticket from the issue tracker (`docs/agents/issue-tracker.md`) and state its title before starting. If the reference is ambiguous, ask.

2. Open the worktree on `fix/<slug>` for a bug ticket or `feat/<slug>` otherwise, where `<slug>` is a kebab-case slug of the title in at most 5 words:

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" <branch>
   ```

   Call EnterWorktree with `path` set to the printed path.

3. Implement the ticket. Call the Skill tool with `mattpocock-skills:tdd` where possible, at pre-agreed seams. Run typechecking regularly, single test files regularly, and the full test suite once at the end.

4. Commit each piece of work as it passes. Every commit carries the ticket as a trailer, eg `git commit --trailer "Ticket: #42"`, which is how `rflow:finish` knows what to resolve.

5. Call the Skill tool with `mattpocock-skills:code-review`, using the base ref as the fixed point. Fix its findings and commit them the same way.

6. Call the Skill tool with `rflow:finish`.
