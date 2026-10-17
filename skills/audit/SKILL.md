---
name: audit
description: Sweep a scope of the repo for bugs, deepening opportunities and doc drift in a docs worktree, then log the picked findings as tickets and finish.
argument-hint: "[path, area or git ref]"
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/improve-codebase-architecture/SKILL.md (the Explore questions) and skills/engineering/triage/SKILL.md (the redundancy and prior rejection checks) at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow scopes the sweep with `rflow hotspots`, asks the Explore questions in one of three parallel category sub-agents beside diagnosing-bugs and domain-modeling, replaces the HTML report and grilling loop with a pick list in chat and the shared handoff, and keeps only triage's two checks. -->

# Audit

An audit sweeps a scope of the repo for **findings** in three categories, **bug**, **deepening opportunity** and **doc drift**, and logs the findings the user picks to the issue tracker as tickets. Every finding reaches the tracker as it was found, and its fix belongs to the ticket's implementation.

The scope is `$ARGUMENTS`, a path, an area in words or a git ref. With no scope, the audit covers the **hot spots**.

1. Open the worktree, titled `audit <scope>`, or `audit <today's date as YYYY MM DD>` with no scope.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open docs '<title in letters, digits and spaces>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree. When EnterWorktree or status fails, report the message and stop.

2. Resolve the scope to the files the sweep starts from, and state them. A path or git ref reaches git in single quotes only when it holds just letters, digits and `./-_`, and any other scope counts as an area.
   - With no scope, run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" hotspots`, which prints the hot spots most changed first.
   - A path that `git ls-files '<path>'` lists files for covers those files.
   - A git ref that `git rev-parse --verify --quiet '<ref>^{commit}'` resolves covers the files `git diff --name-only '<ref>...HEAD'` lists that still exist.
   - An area in words covers the files that implement it, found by searching the worktree with the `GLOSSARY.md` terms.

   The step is done when the chat lists the scope's files.

3. Start the three category sub-agents in one message, one Agent call each, with the prompt built from the shared brief and that category's brief under Category briefs. The step is done when all three have returned.

4. Filter the findings. Drop each finding that lacks a file and line or its category's evidence. Then run triage's two checks on each finding that remains.
   - **Redundancy.** List the open issues through `docs/agents/issue-tracker.md` and match each finding against them by domain concept, beyond its wording.
   - **Prior rejection.** Read every `.out-of-scope/*.md` file and match each finding against them by concept.

   A finding with a match is held back beside its match. The step is done when every finding is kept or held back.

5. Show the pick list in chat. Number the kept findings by category in rank order, each line giving the category, a title, the file and line, and the evidence in one line. List the held-back findings under it unnumbered, each with its match. Ask the user which numbers to log. The step is done when the user has named their picks.

   When the user picks none, call ExitWorktree with `action: "keep"`, run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close <branch>` from the main checkout, and report that the audit logged nothing.

6. Remove every file the bug sub-agent listed as a loop harness, and every `[DEBUG-...]` log. The step is done when `git status` shows only domain doc changes, if any.

7. State each pick's ticket in chat, so `to-tickets` builds from it. Each pick becomes one ticket with no blocking edges to the others. Its first acceptance criterion is its evidence resolved, meaning the red loop goes green for a bug, the module passes the deletion test as a deep module for a deepening opportunity, or the two quotes agree for doc drift. Its label is `bug` for a bug or doc drift and `enhancement` for a deepening opportunity. A bug's ticket carries its loop command and harness source, so it can rebuild the loop.

8. Read `${CLAUDE_PLUGIN_ROOT}/references/handoff.md` and follow it, labelling each ticket as step 7 states. A spec suits picks that share one theme. When the user chooses spec and tickets for picks that span themes, ask them to narrow the picks to one theme or to publish tickets alone, before they type the commands.

## Category briefs

Every prompt opens with the shared brief, then adds its category's brief.

### Shared brief

Give the worktree path, the scope's files and these rules. Work in the worktree, starting from the scope's files and following them into the code they call and the docs that describe them. Read `GLOSSARY.md` and the ADRs in `docs/adr/` first, and name domain concepts in the glossary's terms. Call the Skill tool once, for your lens skill, and do the work in this session. Return at most 5 findings in your category, ranked most important first, each with a title, a file and line, and your category's evidence. A suspect whose evidence you could not produce stays out of the list.

### Bug

The lens is `mattpocock-skills:diagnosing-bugs`. A bug is behaviour that differs from what the code, its tests or its docs intend. For each suspect, run the Build a feedback loop phase and stop at its completion criterion. The evidence is the red loop command, its redacted output, and the source of any harness the loop runs. Rank by blast radius, the callers, users and flows the bug reaches. Write files only as loop harnesses, and return the path of every file you wrote.

### Deepening opportunity

The lens is `mattpocock-skills:codebase-design`. A deepening opportunity is a shallow module, a leaking seam or a missing seam that a refactor could turn into a deep module. Ask these Explore questions of the scope, and note where you feel friction.
- Where does understanding one concept require bouncing between many small modules?
- Where are modules shallow, with an interface nearly as complex as the implementation?
- Where have pure functions been extracted for testability while the bugs hide in how they are called, with no locality?
- Where do tightly coupled modules leak across their seams?
- Which parts are untested, or hard to test through their current interface?

Apply the deletion test to each suspect. The evidence names the module, its interface and the seam, and gives the deletion test result, where deleting the module would concentrate complexity. Rank by leverage, the future changes the deepening makes easier. Leave every file as it is.

### Doc drift

The lens is `mattpocock-skills:domain-modeling`. Doc drift is a doc that contradicts the code or another doc. Cross-reference with code each claim a doc makes about how the scope works, and challenge each term the docs use against `GLOSSARY.md`. The docs include `CLAUDE.md`, `AGENTS.md`, every `SKILL.md`, the files they point to, the README and `docs/`. The evidence quotes both sides, each with its file and line. Rank by reader reach, with agent docs first (`CLAUDE.md`, `AGENTS.md`, `SKILL.md` and the files they point to), then the README, then the rest. Leave every file as it is.
