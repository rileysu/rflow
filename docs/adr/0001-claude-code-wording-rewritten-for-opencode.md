# Claude Code wording, rewritten for OpenCode at registration

The skills keep Claude Code's tool names and variables, and the OpenCode plugin replaces each Claude-only sentence with its OpenCode sentence from one table when it registers the skill, in the same pass that substitutes `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}`. Every translation is then deterministic and tested, so neither harness depends on the model following a mapping, which is where the reported failures of multi-harness skill packs cluster (obra/superpowers #2583, #2157, #2160).

## Considered Options

- Action-worded prose with one shared table each flow reads at its first step. No surveyed pack does this, and it relies on the model applying the table.
- Action-worded prose with a mapping injected by a hook in each harness, as superpowers does. It adds two hooks, context on every session and the subagent leaks superpowers reported.
- Claude Code names with a mapping injected only in OpenCode. It leaves Claude-only names in OpenCode's text.
- Harness-neutral variables in place of `${CLAUDE_PLUGIN_ROOT}`. Claude Code substitutes only its own names, so every script path would break there.

## Consequences

A Claude-only sentence stays word for word the same across skills, and a test fails when any Claude-only tool name survives in a registered skill.
