# Spec handoff

The closing steps shared by `rflow:grill` and `rflow:investigate`. The user picks the spec shape here, so these commands are theirs to type.

1. Commit the docs this session wrote (`GLOSSARY.md`, ADRs).
2. Ask the user: spec only, or spec and tickets?
3. Tell the user to type `/mattpocock-skills:to-spec`, followed by `/mattpocock-skills:to-tickets` when they chose tickets.
4. In the same turn that the last chosen command publishes, commit any files it wrote (a local tracker writes under `.scratch/`) and call the Skill tool with `rflow:finish`.
