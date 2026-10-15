# Handoff

The closing steps shared by `rflow:grill` and `rflow:investigate`. The user picks what to publish, so these commands are theirs to type.

1. Commit the docs this session wrote (`GLOSSARY.md`, ADRs).
2. Ask the user what to publish, and tell them the commands to type for their choice. `to-tickets` works from the conversation when there is no spec, so a small change or a single bug fix can be one ticket.

   | Publish | Commands |
   | --- | --- |
   | Tickets | `/mattpocock-skills:to-tickets` |
   | Spec | `/mattpocock-skills:to-spec` |
   | Spec and tickets | `/mattpocock-skills:to-spec`, then `/mattpocock-skills:to-tickets` |

3. In the same turn that the last command publishes, commit any files it wrote (a local tracker writes under `.scratch/`) and call the Skill tool with `rflow:finish`.
