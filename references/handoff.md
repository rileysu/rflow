# Handoff

The closing steps shared by `rflow:grill` and `rflow:investigate`. The user picks what to publish, so these commands are theirs to type.

1. Commit the docs this session wrote (`GLOSSARY.md`, ADRs).
2. Ask the user whether to publish tickets alone or a spec with tickets, and tell them the commands to type for their choice. Tickets alone suit work of a few tickets, such as a single bug fix, and `to-tickets` builds them from the conversation.

   | Publish | Commands |
   | --- | --- |
   | Tickets | `/mattpocock-skills:to-tickets` |
   | Spec and tickets | `/mattpocock-skills:to-spec`, then `/mattpocock-skills:to-tickets` |

3. In the same turn that `to-tickets` publishes, commit any files the commands wrote (a local tracker writes under `.scratch/`) and call the Skill tool with `rflow:finish`.
