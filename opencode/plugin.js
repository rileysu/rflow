// @ts-check
// rflow's OpenCode V2 plugin. It registers every rflow skill under its Claude
// Code id, `rflow:<name>`, with Claude Code's wording rewritten for OpenCode
// through the rewrite table (docs/adr/0001).
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rewriteTable } from "./rewrite-table.js";

/** @typedef {import("./rewrite-table.js").RewriteContext} RewriteContext */
/** @typedef {import("./rewrite-table.js").RewriteRow} RewriteRow */

/**
 * The fields of OpenCode's `Skill.Info` that rflow sets.
 * @typedef {object} SkillInfo
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {boolean} autoinvoke
 * @property {string} path absolute path of the skill's SKILL.md
 * @property {string} content
 */

/**
 * The frontmatter keys rflow reads from a SKILL.md.
 * @typedef {object} Frontmatter
 * @property {string} name
 * @property {string} description
 * @property {boolean} disableModelInvocation
 */

// OpenCode installs plugins into a cache path that changes on each update, so
// every path comes from this module's own location.
const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// One alternation of every row's Claude text, longest first so a row never
// loses to a shorter row that is its prefix.
const claudeText = new RegExp(
  [...rewriteTable]
    .sort((a, b) => b.claude.length - a.claude.length)
    .map((row) => row.claude.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g",
);
const rowsByClaudeText = new Map(rewriteTable.map((row) => [row.claude, row]));

/**
 * Replaces every piece of Claude-only text with its OpenCode text in one pass,
 * so no replacement is rewritten again by a later row.
 * @param {string} content
 * @param {RewriteContext} context
 */
function rewrite(content, context) {
  return content.replace(claudeText, (match) => {
    const { opencode } = /** @type {RewriteRow} */ (rowsByClaudeText.get(match));
    return typeof opencode === "function" ? opencode(context) : opencode;
  });
}

/**
 * Splits a SKILL.md into its frontmatter and body. The frontmatter holds flat
 * `key: value` lines, with a value optionally wrapped in double quotes.
 * @param {string} text
 * @returns {{ frontmatter: Frontmatter, body: string }}
 */
function parseSkillFile(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  /** @type {Map<string, string>} */
  const fields = new Map();
  for (const line of (match?.[1] ?? "").split("\n")) {
    const field = /^([\w-]+):\s*(.*)$/.exec(line);
    if (field) fields.set(field[1], field[2].replace(/^"(.*)"$/, "$1"));
  }
  return {
    frontmatter: {
      name: fields.get("name") ?? "",
      description: fields.get("description") ?? "",
      disableModelInvocation: fields.get("disable-model-invocation") === "true",
    },
    body: text.slice(match?.[0].length ?? 0),
  };
}

/**
 * Reads the skill in each directory as an OpenCode skill with id
 * `<prefix>:<directory name>`.
 * @param {string} prefix
 * @param {readonly string[]} skillDirs absolute skill directories
 * @returns {SkillInfo[]}
 */
function readSkills(prefix, skillDirs) {
  return skillDirs.map((skillDir) => {
    const path = join(skillDir, "SKILL.md");
    const { frontmatter, body } = parseSkillFile(readFileSync(path, "utf8"));
    const id = `${prefix}:${basename(skillDir)}`;
    return {
      id,
      name: frontmatter.name || id,
      description: frontmatter.description,
      autoinvoke: !frontmatter.disableModelInvocation,
      path,
      content: rewrite(body, { pluginRoot, skillDir }),
    };
  });
}

/** @param {string} root */
function childDirectories(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name));
}

export default {
  id: "rflow",
  /** @param {any} ctx OpenCode's V2 plugin context */
  async setup(ctx) {
    if (typeof ctx?.skill?.transform !== "function") {
      console.warn("rflow: this OpenCode has no V2 skill domain, so rflow stays inert. rflow needs OpenCode 2.1 or later.");
      return;
    }
    const skills = readSkills("rflow", childDirectories(join(pluginRoot, "skills")));
    await ctx.skill.transform((/** @type {any} */ editor) => {
      for (const skill of skills) editor.add(skill);
    });
  },
};
