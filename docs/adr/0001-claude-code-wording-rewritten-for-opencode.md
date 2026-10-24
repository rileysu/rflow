# Claude Code wording, rewritten for OpenCode at registration

The skills keep Claude Code's wording, including Claude-only text, meaning a sentence or phrase that names a tool, variable or skill id only Claude Code resolves. When the OpenCode plugin registers a skill, one pass substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` and replaces each piece of Claude-only text with its OpenCode text from one rewrite table. Every translation is then deterministic and tested, so neither harness depends on the model following a mapping, which is where the reported failures of multi-harness skill packs cluster (obra/superpowers #2583, #2157, #2160).

## Considered Options

- Action-worded prose with one shared table each flow reads at its first step. None of the 12 skill packs surveyed does this, and it relies on the model applying the table.
- Action-worded prose with a mapping injected by a hook in each harness, as obra/superpowers does. It adds two hooks, injects context into every session, and risks the subagent leaks superpowers reported.
- Claude Code names with a mapping injected only in OpenCode. It leaves Claude-only text in what OpenCode's model reads.
- Harness-neutral variables in place of `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}`. Claude Code substitutes only its own names, so every script path would break there.

## Consequences

Each piece of Claude-only text matches its rewrite table entry word for word, and a test fails when any Claude-only text, such as `${CLAUDE_`, EnterWorktree or `$ARGUMENTS`, survives in a registered skill.
