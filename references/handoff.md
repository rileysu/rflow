# Handoff

The closing steps shared by `rflow:grill`, `rflow:investigate` and `rflow:audit`. `to-spec` and `to-tickets` are user-invoked, so the user types them.

1. Commit the docs this session wrote (`GLOSSARY.md`, ADRs).
2. Ask the user whether to publish tickets alone or a spec with tickets, and tell them the commands to type for their choice. Tickets alone suit work of a few tickets, such as a single bug fix, and `to-tickets` builds them from the conversation.

   | Publish | Commands |
   | --- | --- |
   | Tickets | `/mattpocock-skills:to-tickets` |
   | Spec and tickets | `/mattpocock-skills:to-spec`, then `/mattpocock-skills:to-tickets` |

3. In the same turn that `to-tickets` publishes, label each ticket it published through the label operation in `docs/agents/issue-tracker.md`, `bug` when the ticket repairs broken behaviour or doc drift and `enhancement` otherwise. The step is done when every published ticket carries exactly one of `bug` or `enhancement` beside the `ready-for-agent` label that `to-tickets` applied.
4. In that same turn, commit any files the commands and labels wrote (a local tracker writes under `.scratch/`) and call the Skill tool with `rflow:finish`.
