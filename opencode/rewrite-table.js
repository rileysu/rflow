// @ts-check
// The rewrite table pairs each piece of Claude-only text in a skill with its
// OpenCode text (docs/adr/0001). It is the only harness-specific text the
// plugin holds. Add a row per Claude-only sentence or phrase, matching the
// skills word for word, or a pattern row when the text comes in several shapes.

/**
 * The places a registered skill's paths resolve to.
 * @typedef {object} RewriteContext
 * @property {string} pluginRoot absolute path of the installed rflow package
 * @property {string} skillDir absolute path of the skill's directory
 * @property {ReadonlySet<string>} pocockSkills every skill name Pocock's
 *   Claude plugin manifest lists
 * @property {ReadonlySet<string>} pocockCommands the Pocock skill names that
 *   are user-invoked, so OpenCode has a command for each
 */

/**
 * One piece of Claude-only text and what OpenCode reads in its place.
 * @typedef {object} RewriteRow
 * @property {string} claude the exact Claude Code text
 * @property {string | ((context: RewriteContext) => string)} opencode
 */

/** @type {readonly RewriteRow[]} */
export const rewriteTable = [
  { claude: "${CLAUDE_PLUGIN_ROOT}", opencode: ({ pluginRoot }) => pluginRoot },
  { claude: "${CLAUDE_SKILL_DIR}", opencode: ({ skillDir }) => skillDir },
  // OpenCode's subagents start in the parent's directory, so the parent creates
  // each worktree where Claude Code would and the subagent moves into it.
  {
    claude: 'Start each one through the Agent tool with `isolation: "worktree"`.',
    opencode:
      "Start each one by running `git worktree add -b 'worktree-agent-<ticket number>' -- '<main_checkout>/.claude/worktrees/agent-<ticket number>' '<branch>'` with `main_checkout` and `branch` from step 3's status, then calling the `subagent` tool with `background: true` and a prompt that first tells it to call `session_move` through `execute` with `directory` set to that worktree.",
  },
  // OpenCode's `session_move` runs only inside `execute`.
  {
    claude: "EnterWorktree with `path` set to the printed path",
    opencode: "`session_move` through `execute` with `directory` set to the printed path",
  },
  {
    claude: 'ExitWorktree with `action: "keep"`',
    opencode: "`session_move` through `execute` with `directory` set to the main checkout",
  },
  // OpenCode substitutes `$ARGUMENTS` only in command templates, and a command
  // sends the typed text as the message beside the attached skill.
  { claude: "`$ARGUMENTS` holds", opencode: "The text typed after the command holds" },
  { claude: "`$ARGUMENTS`", opencode: "the text typed after the command" },
  { claude: "one Agent call each", opencode: "one `subagent` tool call each" },
  {
    claude: "one background Agent call",
    opencode: "one `subagent` tool call with `background: true`",
  },
];

/**
 * Claude-only text that comes in several shapes, so a pattern matches it. The
 * pattern matches only a skill name, with the text around it in lookarounds,
 * and holds no numbered backreferences. `opencode` returns the text that
 * replaces the name, which is the name itself to leave it as it is.
 * @typedef {object} PatternRow
 * @property {RegExp} claude
 * @property {(name: string, context: RewriteContext) => string} opencode
 */

/** @type {readonly PatternRow[]} */
export const patternTable = [
  // A bare Pocock skill name in a Skill tool call, as in `Skill tool with
  // "grilling"`, ``Skill tool with `tdd` `` or `Skill tool twice, for
  // "grilling" and "domain-modeling"`. OpenCode knows it only by its id.
  {
    claude: /(?<=Skill tool (?:with|twice, for(?: ["`][\w-]+["`] and)?) ["`])[\w-]+(?=["`])/,
    opencode: (name, { pocockSkills }) =>
      pocockSkills.has(name) ? `mattpocock-skills:${name}` : name,
  },
  // A bare Pocock slash command told to the user, as in "tell the user to run
  // `/setup-matt-pocock-skills`". OpenCode has a command only for each
  // user-invoked skill, named by its id.
  {
    claude: /(?<=(?<![^\s`(])\/)[\w-]+(?![\w:/-])/,
    opencode: (name, { pocockCommands }) =>
      pocockCommands.has(name) ? `mattpocock-skills:${name}` : name,
  },
];
