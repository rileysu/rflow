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
];
