// @ts-check
// rflow's OpenCode V2 plugin. It registers every rflow skill, and every skill
// Matt Pocock's Claude plugin manifest lists, under its Claude Code id,
// `rflow:<name>` or `mattpocock-skills:<name>`, with Claude Code's wording
// rewritten for OpenCode through the rewrite table (docs/adr/0001), and gives
// each user-invoked skill a slash command of the same name.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { patternTable, rewriteTable } from "./rewrite-table.js";

/** @typedef {import("./rewrite-table.js").RewriteContext} RewriteContext */

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

// Pocock's package has no `main` or `exports`, so it resolves by the subpath
// of its Claude plugin manifest, the file the skill list comes from.
const pocockManifest = createRequire(import.meta.url).resolve(
  "mattpocock-skills/.claude-plugin/plugin.json",
);
const pocockRoot = join(dirname(pocockManifest), "..");

/** The skill directories Pocock's Claude plugin manifest lists. */
function pocockSkillDirs() {
  /** @type {{ skills: string[] }} */
  const manifest = JSON.parse(readFileSync(pocockManifest, "utf8"));
  return manifest.skills.map((path) => join(pocockRoot, path));
}

/**
 * One row of either table, as the single rewrite pass applies it.
 * @typedef {(match: string, context: RewriteContext) => string} Replacement
 */

// Phrase rows go longest first so a row never loses to a shorter row that is
// its prefix, and pattern rows go last.
const rows = [
  ...[...rewriteTable]
    .sort((a, b) => b.claude.length - a.claude.length)
    .map((row) => ({
      source: row.claude.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      /** @type {Replacement} */
      replace: (_, context) =>
        typeof row.opencode === "function" ? row.opencode(context) : row.opencode,
    })),
  ...patternTable.map((row) => ({
    source: row.claude.source,
    /** @type {Replacement} */
    replace: (match, context) => row.opencode(match, context),
  })),
];

// One alternation of every row, each in a named group that says which row
// matched.
const claudeText = new RegExp(
  rows.map((row, index) => `(?<row${index}>${row.source})`).join("|"),
  "g",
);

/**
 * Replaces every piece of Claude-only text with its OpenCode text in one pass,
 * so no replacement is rewritten again by a later row.
 * @param {string} content
 * @param {RewriteContext} context
 */
function rewrite(content, context) {
  return content.replace(claudeText, (match, ...args) => {
    /** @type {Record<string, string | undefined>} */
    const groups = args[args.length - 1];
    const index = rows.findIndex((_, i) => groups[`row${i}`] !== undefined);
    return rows[index].replace(match, context);
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
 * A skill as read from its package, before the rewrite.
 * @typedef {object} SkillSource
 * @property {string} id `<prefix>:<directory name>`
 * @property {string} name the directory name
 * @property {string} pluginRoot absolute root of the package the skill ships in
 * @property {string} skillDir
 * @property {Frontmatter} frontmatter
 * @property {string} body
 */

/**
 * Reads the skill in each directory with id `<prefix>:<directory name>`.
 * @param {string} prefix
 * @param {string} pluginRoot absolute root of the package the skills ship in
 * @param {readonly string[]} skillDirs absolute skill directories
 * @returns {SkillSource[]}
 */
function readSkills(prefix, pluginRoot, skillDirs) {
  return skillDirs.map((skillDir) => {
    const { frontmatter, body } = parseSkillFile(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
    const name = basename(skillDir);
    return { id: `${prefix}:${name}`, name, pluginRoot, skillDir, frontmatter, body };
  });
}

/**
 * The OpenCode skill for a source, with its content rewritten.
 * @param {SkillSource} source
 * @param {Omit<RewriteContext, "pluginRoot" | "skillDir">} pocock
 * @returns {SkillInfo}
 */
function toSkillInfo({ id, pluginRoot, skillDir, frontmatter, body }, pocock) {
  return {
    id,
    name: frontmatter.name || id,
    description: frontmatter.description,
    autoinvoke: !frontmatter.disableModelInvocation,
    path: join(skillDir, "SKILL.md"),
    content: rewrite(body, { pluginRoot, skillDir, ...pocock }),
  };
}

/** @param {string} root */
function childDirectories(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name));
}

/**
 * The fields of OpenCode's `CommandInvocation` that rflow reads.
 * @typedef {object} CommandInvocation
 * @property {string} sessionID
 * @property {{ text: string, skills?: { id: string }[] }} prompt holds the text typed after the command
 * @property {"steer" | "queue"} delivery
 */

/**
 * A slash command that prompts the session with the skill attached by id and
 * the typed text as the message, as Claude Code starts a user-invoked skill.
 * @param {any} ctx OpenCode's V2 plugin context
 * @param {SkillInfo} skill
 */
function skillCommand(ctx, skill) {
  return {
    name: skill.id,
    description: skill.description,
    /** @param {CommandInvocation} input */
    execute: ({ sessionID, prompt, delivery }) =>
      ctx.session.prompt({
        ...prompt,
        sessionID,
        delivery,
        skills: [...(prompt.skills ?? []), { id: skill.id }],
      }),
  };
}

export default {
  id: "rflow",
  /** @param {any} ctx OpenCode's V2 plugin context */
  async setup(ctx) {
    if (typeof ctx?.skill?.transform !== "function") {
      console.warn("rflow: this OpenCode has no V2 skill domain, so rflow stays inert. rflow needs OpenCode 2.1 or later.");
      return;
    }
    const rflowSkills = readSkills("rflow", pluginRoot, childDirectories(join(pluginRoot, "skills")));
    const pocockSkills = readSkills("mattpocock-skills", pocockRoot, pocockSkillDirs());
    const pocock = {
      pocockSkills: new Set(pocockSkills.map((skill) => skill.name)),
      pocockCommands: new Set(
        pocockSkills.filter((skill) => skill.frontmatter.disableModelInvocation).map((skill) => skill.name),
      ),
    };
    const skills = [...rflowSkills, ...pocockSkills].map((source) => toSkillInfo(source, pocock));
    await ctx.skill.transform((/** @type {any} */ editor) => {
      for (const skill of skills) editor.add(skill);
    });
    if (typeof ctx.command?.transform !== "function") {
      console.warn("rflow: this OpenCode has no V2 command domain, so the flows have no slash commands. rflow needs OpenCode 2.1 or later.");
      return;
    }
    await ctx.command.transform((/** @type {any} */ editor) => {
      for (const skill of skills) {
        if (!skill.autoinvoke) editor.add(skillCommand(ctx, skill));
      }
    });
  },
};
