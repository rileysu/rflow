# Copy the Pocock skills rflow uses and drop the dependency

rflow copies the skills it references from Matt Pocock's package into its own tree and removes the `mattpocock-skills` dependency, so one install delivers everything and rflow owns each skill's wording and invocation. Each copy opens with a comment naming the upstream path, commit, licence and what rflow changed, and upstream changes arrive only when someone re-syncs by hand, diffing from that commit.

## Considered Options

- Keep the dependency. Claude Code installs need a second marketplace, the OpenCode plugin resolves Pocock's package to find its skill list and needs rewrite rows for its skill names, and the skills rflow never references stay active.
- Ship the copies as a second plugin in the same marketplace, which gives ids such as `rflow-practices:tdd`. It adds a second version to bump and a dependency to keep, and it needs a matching split of OpenCode's single package.

## Consequences

Upstream fixes stop arriving on update. Someone who installs Pocock's plugin beside rflow gets both sets of model-invoked skills.
