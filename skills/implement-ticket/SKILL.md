---
name: implement-ticket
description: Implement one ticket in a worktree in this session, then finish with a pull request or local merge.
argument-hint: <issue number, URL or ticket file>
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow adds the worktree, the commit trailers and the hand-off to rflow:finish. -->

# Implement ticket

The ticket reference is `$ARGUMENTS`, an issue number or URL, or a ticket file path for a local tracker. Ask for one if it is empty.

1. Run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" sync`. It fast-forwards the default branch and checks that `/rflow:setup` has run. When it fails, report its message and stop.

2. Read `docs/agents/issue-tracker.md`, fetch the ticket through it and state its title before starting. When the reference is ambiguous, ask.

3. Open the worktree, as `fix` when the ticket reports broken behaviour and `feat` otherwise.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open <fix|feat> "<ticket title>"
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

4. Implement the ticket. Call the Skill tool with `mattpocock-skills:tdd` at pre-agreed seams. Run typechecking and the affected test file after each red-green cycle. Done when every acceptance criterion in the ticket has a passing test and the full test suite passes.

5. Commit each piece of work as it passes. Every commit carries the ticket as a trailer, eg `git commit --trailer "Ticket: #42"`, which is how `rflow:finish` knows what to resolve.

6. Call the Skill tool with `rflow:finish`. It reviews the branch before shipping.
