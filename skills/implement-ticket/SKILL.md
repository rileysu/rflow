---
name: implement-ticket
description: Implement one ticket in a worktree in this session, then finish with a pull request or local merge.
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/implement/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. -->

# Implement ticket

The ticket reference is the skill's arguments, as an issue number or URL, or a ticket file path for a local tracker.

1. Read `docs/agents/issue-tracker.md`. When it is missing, tell the user to run `/rflow:setup` and stop. Fetch the ticket through it and state its title before starting. When the reference matches more than one ticket, ask the user to pick.

2. Open the worktree on `fix/<slug>` for a bug ticket or `feat/<slug>` for the rest, where `<slug>` is a kebab-case slug of the title in at most 5 words.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/open-worktree.sh" branch <branch>
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path.

3. Implement the ticket. Call the Skill tool with `mattpocock-skills:tdd` at pre-agreed seams. Run typechecking and the affected test file after each red-green cycle, and the full test suite once at the end.

4. Commit each piece of work as it passes. Every commit carries the ticket as a trailer, eg `git commit --trailer "Ticket: #42"`, which is how `rflow:finish` knows what to resolve.

5. Call the Skill tool with `rflow:finish`. It reviews the branch before shipping.
