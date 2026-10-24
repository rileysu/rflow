// @ts-check
// The rewrite table pairs each piece of Claude-only text in a skill with its
// OpenCode text (docs/adr/0001). It is the only harness-specific text the
// plugin holds. Add a row per Claude-only sentence or phrase, matching the
// skills word for word.

/**
 * The places a registered skill's paths resolve to.
 * @typedef {object} RewriteContext
 * @property {string} pluginRoot absolute path of the installed rflow package
 * @property {string} skillDir absolute path of the skill's directory
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
      "Start each one by running `git worktree add -b worktree-agent-<ticket number> <main_checkout>/.claude/worktrees/agent-<ticket number> <branch>` with `main_checkout` and `branch` from step 3's status, then calling the `subagent` tool with `background: true` and a prompt that first tells it to call `session_move` with `directory` set to that worktree.",
  },
  { claude: "one Agent call each", opencode: "one `subagent` tool call each" },
  {
    claude: "one background Agent call",
    opencode: "one `subagent` tool call with `background: true`",
  },
];
