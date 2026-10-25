---
name: wayfinder
description: Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on GitHub, and resolve them one at a time in docs worktrees until the way to the destination is clear.
argument-hint: "<idea | map number or URL> [ticket]"
disable-model-invocation: true
---

<!-- Adapted from mattpocock/skills skills/engineering/wayfinder/SKILL.md at 49dd158 (v1.3.1). MIT License, Copyright (c) 2026 Matt Pocock. rflow runs charting, grilling and prototype sessions in docs worktrees that end in rflow:finish, commits glossary terms and ADRs as they are written, posts research notes as resolution comments in place of research branches, keeps each prototype on a pushed prototype branch with no pull request, claims research tickets before their subagents start and fires those subagents in both modes, closes the map with a hand-off to rflow:grill, and inlines the gh and rflow commands in place of the tracker-specific paragraph and the local-markdown default. -->

# Wayfinder

A loose idea has arrived, too big for one agent session, and wrapped in fog: the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **shared map** on the repo's issue tracker, then works its **decision tickets** (questions whose resolution is a decision, not slices of a build to execute) one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting: it shapes every ticket. It might be a spec to hand off and iterate on, a decision to lock before planning starts, or a change made in place like a data-structure migration. The map is domain-agnostic: engineering work, course content, whatever fits the shape.

`$ARGUMENTS` holds a loose idea, or a map as an issue number or URL followed by an optional ticket. Ask for one if it is empty. Read `docs/agents/issue-tracker.md` first, and stop unless it names GitHub, telling the user that wayfinder works only with GitHub. An issue reaches the shell as its number, digits only. When the first word is an issue, run `gh issue view '<number>' --json labels --jq '.labels[].name'`. An issue labelled `wayfinder:map` selects [Work through the map](#work-through-the-map), and anything else is an idea for [Chart the map](#chart-the-map). Done when the mode is chosen.

## Plan, don't do

Wayfinder is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear, with nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off. An effort can override this in its **Notes**, carrying execution into the map itself, but absent that, produce decisions, not deliverables.

## Refer by name

Every map and ticket is an issue, so it has a **name**: its title. In everything the human reads (narration, the map's Decisions-so-far), refer to it by that name, never by a bare id, number, or slug. A wall of `#42, #43, #44` is illegible; names read at a glance. The id and URL don't vanish; a name wraps its link, but they ride _inside_ the name, never stand in for it.

## The Map

The map is a single issue on this repo's issue tracker, labelled `wayfinder:map`, the canonical artifact. Its tickets are child issues of the map.

The map is an **index**, not a store. It lists the decisions made and points at the tickets that hold their detail; a decision lives in exactly one place, its ticket, so the map never restates it, only gists it and links.

### Operations

Each operation on the map and its tickets is one command. A title reaches the shell in single quotes, cut down to letters, digits and spaces. A body or comment goes through a file you write with the Write tool to `/tmp/rflow/<owner>-<repo>-<name>.md`, where `<owner>-<repo>` comes from `gh repo view --json owner,name --jq '"\(.owner.login)-\(.name)"'` and `<name>` is the issue number, or a slug of the title for an issue not yet created.

- **Create the map** with `gh issue create --label wayfinder:map --title '<title>' --body-file <file>`.
- **Create a ticket** with `gh issue create --parent '<map>' --label 'wayfinder:<type>' --title '<title>' --body-file <file>`.
- **Block a ticket** with `gh api --method POST 'repos/{owner}/{repo}/issues/<ticket>/dependencies/blocked_by' -F issue_id=<id>`, where `<id>` is the blocker's database id from `gh api 'repos/{owner}/{repo}/issues/<blocker>' --jq .id`.
- **Claim a ticket** with `gh issue edit '<ticket>' --add-assignee @me`.
- **List the frontier** with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" frontier '<map>'`, whose first line is `open=<n>` and whose other lines are the frontier tickets in map order.
- **Resolve an issue** with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" resolve '<issue>' <file>`, which posts the file as the resolution comment and closes the issue.
- **Edit the map body** by reading it with `gh issue view '<map>' --json body --jq .body` right before each edit, since other sessions edit it too, then writing the new body to a file and running `gh issue edit '<map>' --body-file <file>`. The main session is the only writer of the map body.

### The map body

The whole map at low resolution, loaded once per session. Open tickets are **not** listed: they are open child issues, found by query.

```markdown
## Destination

<what reaching the end of this map looks like: the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes

<domain; skills every session should consult; standing preferences for this effort>

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [<closed ticket title>](link): <one-line gist of the answer>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
```

### Tickets

Each ticket is a **child issue** of the map; the tracker's issue id is its identity. Its body is the question, sized to one 100K token agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

Each ticket carries a `wayfinder:<type>` label, one of `research`, `prototype`, `grilling`, `task` (see [Ticket Types](#ticket-types)). `wayfinder:` labels are the only labels a map and its tickets carry, never a triage label like `ready-for-agent`: they are decisions, not implementation work.

A session **claims** a ticket by assigning it to the dev driving the map, **first**, before any work, so concurrent sessions skip it. That assignee _is_ the claim: an open, unassigned ticket is unclaimed.

Blocking uses the tracker's **native** dependency relationship: essential because it renders the frontier _visually_ in the tracker's own UI, so the human sees what's takeable without opening the map. A ticket is **unblocked** when every ticket blocking it is closed; the **frontier** is the open, unblocked, unclaimed children, the edge of the known.

The answer isn't part of the body; it's recorded on resolution (see [Work through the map](#work-through-the-map)). Assets created while resolving a ticket are linked from the issue, not pasted in.

## Ticket Types

Every ticket is either **HITL** (human in the loop, worked _with_ a human who speaks for themselves) or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the human's side of it (a grilling agent that answers its own questions has broken this).

- **Research** (AFK): Reading documentation, third-party APIs, or local resources like knowledge bases to surface a fact a decision waits on. Resolved by a [research subagent](#research-subagents), whose research notes become the ticket's resolution comment. Use when knowledge outside the current working directory is required.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to (an outline, a rough take, a stub, or UI/logic code) by calling the Skill tool with "prototype". The artifact lives on a **prototype branch** in its own worktree, which is pushed, linked from the resolution comment and closed with no pull request. The resolution comment records the verdict and the question it settled, and the verdict changes nothing outside that branch. Use when "how does it look" or "how does it behave" is the key question.
- **Grilling** (HITL): Conversation. The default case. Always call the Skill tool twice, for "grilling" and "domain-modeling".
- **Task** (HITL or AFK): Manual work that must happen before a _decision_ can be made: nothing to decide, prototype, or research, but the discussion is blocked until it's done. Signing up for a service so its API can be judged, provisioning access, moving data so its shape can be seen. This is the one type that _does_ rather than decides, and it earns its place by unblocking a decision, not by delivering the destination. The agent drives it alone where it can (AFK); otherwise it hands the human a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts (credentials location, new URLs, row counts) later tickets depend on.

### Research subagents

A session claims each research ticket, then starts one background Agent call for it with this prompt, filled in with the ticket, its title and the map:

> Resolve research ticket #N, "<title>", of map #M. Read it with `gh issue view N`, then call the Skill tool with `mattpocock-skills:research` to answer its question. Write the research notes to `/tmp/rflow/<owner>-<repo>-N.md` instead of the repo, opening with a gist that answers the question in one line, or a few when the answer needs them. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" resolve N /tmp/rflow/<owner>-<repo>-N.md` and report the gist.

The session waits for every research subagent it started and appends each reported gist to Decisions so far. Done when every one has reported and its gist is on the map.

## Fog of war

The map is _deliberately_ incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **fog of war**: the dim view of decisions and investigations you can tell are coming but can't yet pin down, because they hang on questions still open. Resolving a ticket clears the fog ahead of it, graduating whatever's now specifiable into fresh tickets, one at a time, until the way to the destination is clear and no tickets remain.

The map's **Not yet specified** section is where that dim view is written down: the suspected question, the area to revisit later. It's the undiscovered frontier _toward_ the destination: everything here is in scope, just not sharp enough to ticket. Write as loosely or as fully as the view allows; it doubles as a signpost for collaborators reading where the effort is headed.

**Fog or ticket?** The test is whether you can state the question precisely now, _not_ whether you can answer it now.

- **Ticket when** the question is already sharp, even if it's blocked and you can't act on it yet.
- **Not yet specified when** you can't yet phrase it that sharply. Don't pre-slice the fog into ticket-sized pieces: it's coarser than a ticket, and one patch may graduate into several tickets, or none, once the frontier reaches it.

**Not yet specified** excludes what's already decided (Decisions so far), what's already a live ticket, and what's out of scope (the next section).

## Out of scope

Fog only ever gathers _toward_ the destination. The destination fixes the scope, so work beyond it is **out of scope**: it isn't fog, and it doesn't belong in **Not yet specified**. It gets its own **Out of scope** section on the map: work you've consciously ruled out of _this_ effort. Scope, not sharpness, lands it here.

Out-of-scope work never graduates (the frontier stops at the destination), so it returns only if the destination is redrawn, and then as a fresh effort, not a resumption.

Ruling something out of scope is a scoping act, not a step on the route. When a ticket that already exists turns out to sit past the destination (mis-scoped in while charting, or exposed by a resolution), **close it** as not planned with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" resolve --not-planned '<ticket>' <file>`, posting why it is out of scope (a closed ticket is unambiguously off the frontier), and leave one line in the **Out of scope** section: the gist plus why it's out of scope, linking the closed ticket. It stays out of **Decisions so far**, which records the route actually walked; a scope boundary isn't a step on it.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session**, with the exception of research tickets.

A session with a docs worktree commits each glossary term and ADR there as it is written, with a message naming the term or decision. A research or task session, which has no docs worktree, records any new term or decision in its resolution comment.

### Open a docs worktree

Charting sessions and grilling and prototype sessions each open one, from the main checkout.

```sh
"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open docs '<title in letters, digits and spaces>'
```

When `open` names `rflow reopen <branch>`, a crashed session left that branch, so run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" reopen '<branch>'` to resume it. Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree. When `open`, `reopen` or either step fails, report the message and stop.

### Chart the map

User invokes with a loose idea.

1. **Open a docs worktree** titled after the idea.
2. **Name the destination.** Call the Skill tool twice, for "grilling" and "domain-modeling", to pin down what this map is finding its way to: the spec, decision, or change. The destination fixes the scope, so it's settled first.
3. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. **If this surfaces no fog** (the way to the destination is already clear, the whole journey small enough for one session), you don't need a map. Stop and ask the user how they'd like to proceed.
4. **Create the map** (label `wayfinder:map`): Destination and Notes filled in, Decisions-so-far empty, the fog sketched into **Not yet specified**.
5. **Create the tickets you can specify now** as child issues of the map, then wire blocking edges in a **second pass** (issues need ids before they can reference each other). Write cross-references in that pass too, with real ids: a placeholder `#<n>` auto-links to an unrelated issue. Wiring sorts them into the frontier and the blocked; everything you can't yet specify stays in the fog: the **Not yet specified** section.
6. **Fire the research subagents.** For each `research` ticket you just created, start its [research subagent](#research-subagents) to resolve it in parallel, and wait for them all. Then run the check in [Close the map](#close-the-map).
7. Stop: charting is one session's work; it hand-resolves nothing. Call the Skill tool with `rflow:finish` to ship the worktree.

### Work through the map

User invokes with a map (URL or number). A ticket is **optional**: without one, you pick the next decision, not the user.

1. Load the **map**: the low-res view, not every ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. When the frontier lists no ticket, run the check in [Close the map](#close-the-map) if it printed `open=0`, or else report that every open ticket is blocked or claimed, and stop. **Claim it**: assign it to yourself before any work.
3. Open the ticket's worktrees, titled after the ticket. A grilling ticket gets a docs worktree. A prototype ticket also gets a prototype worktree, so first run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open prototype '<title in letters, digits and spaces>'` from the main checkout, or the `rflow reopen '<branch>'` its refusal names when a pushed prototype branch already exists, keep its printed path and its branch from `git -C '<path>' branch --show-current`, and report the path. Then open the docs worktree. Research and task tickets run in the main checkout. Done when each worktree the type needs is open.
4. Resolve it as the type its `wayfinder:<type>` label names (see [Ticket Types](#ticket-types)). Read the label, not just the body: the body never states the type. **Zoom as needed**: fetch the full body of any related or closed ticket on demand; call the Skill tool for whichever skills the `## Notes` block names. If in doubt, call the Skill tool twice, for "grilling" and "domain-modeling".
   - A research ticket goes to its [research subagent](#research-subagents), which posts the resolution comment and closes the issue. Wait for it to report its gist, so step 5 only appends the context pointer.
   - A prototype is built in the prototype worktree, committed there with `git -C '<path>'`, pushed with `git -C '<path>' push -u origin '<branch>'`, and its local worktree and branch removed with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" close '<branch>'`.
5. Record the resolution: post the answer as a **resolution comment** and **close** the issue in one **resolve**, and **append a context pointer** to the map's Decisions-so-far. A prototype's resolution comment links its branch at `https://github.com/<owner>/<repo>/tree/<branch>`.
6. Add newly-surfaced tickets (create-then-wire), and start a research subagent for each research ticket among them; graduate any fog the answer has made specifiable, clearing each graduated patch from **Not yet specified** so it lives only as its new ticket. If the answer reveals that a ticket (this one or another) sits beyond the destination, **rule it out of scope** rather than resolving it on the route. If the decision invalidates other parts of the map, update or delete those tickets. Wait for every research subagent this session started.
7. Run the check in [Close the map](#close-the-map). Then, when the session opened a docs worktree, call the Skill tool with `rflow:finish` to ship it.

The user may run unblocked tickets in parallel, so expect other sessions to be editing the tracker concurrently.

### Close the map

List the frontier. When it prints `open=0` and the map's **Not yet specified** is empty, the way to the destination is clear, so resolve the map with a resolution comment that summarises the route walked to the destination. For a spec destination, end the session by telling the user to type `/rflow:grill <map>`, which builds the spec on the decisions the map's tickets record. For a decision or a change made in place, end it by reporting the destination reached. Done when the map is closed, or the frontier shows open tickets or **Not yet specified** holds fog.
