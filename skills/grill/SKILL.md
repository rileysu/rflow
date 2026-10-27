---
name: grill
description: Grill a plan in a docs worktree, recording glossary terms and ADRs, then hand off to tickets and finish.
argument-hint: <topic | issue number or URL>
disable-model-invocation: true
---

# Grill

The topic is `$ARGUMENTS`. Ask for one if it is empty.

When the topic is an issue number or URL, read the issue before step 1 with `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" view '<number>'`, with the number cut down to digits. The issue is the topic, and its title is the topic title in step 1. When its `labels` hold `wayfinder:map`, its closed tickets hold decisions already made. Each closed entry in its `subIssues` is a ticket, and the ticket's `lastComment` is its resolution comment. A ticket whose `stateReason` is `NOT_PLANNED` was ruled out of scope, so it holds no decision. Grilling builds on those decisions and asks only what they leave open. Done when every closed ticket's resolution comment is read.

1. Open the worktree.

   ```sh
   "${CLAUDE_PLUGIN_ROOT}/scripts/rflow" open docs '<short topic title in letters, digits and spaces>'
   ```

   Call EnterWorktree with `path` set to the printed path, and report the path. Then run `"${CLAUDE_PLUGIN_ROOT}/scripts/rflow" status`, which succeeds only inside the worktree. When either step fails, report the message and stop.

2. Call the Skill tool twice, for `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`, and grill the topic. Commit each glossary term and ADR as it is written, with a message naming the term or decision. Done when the user confirms a shared understanding.

3. Read `${CLAUDE_PLUGIN_ROOT}/references/handoff.md` and follow it.
