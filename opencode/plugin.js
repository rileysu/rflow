// @ts-check
// rflow's OpenCode V2 plugin. It registers every rflow skill in `skills/` and
// `practices/` under its Claude Code id, `rflow:<name>`, with Claude Code's
// wording rewritten for OpenCode through the rewrite table (docs/adr/0001), and
// gives each user-invoked skill a slash command of the same name.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rewriteTable } from "./rewrite-table.js";

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
// the package root comes from this module's own location.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Each row's OpenCode text, keyed by its exact Claude Code text. */
const opencodeText = new Map(rewriteTable.map((row) => [row.claude, row.opencode]));

// One alternation of every row, longest first so a row never loses to a shorter
// row that is its prefix.
const claudeText = new RegExp(
  [...opencodeText.keys()]
    .sort((a, b) => b.length - a.length)
    .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g",
);

/**
 * Replaces every piece of Claude-only text with its OpenCode text in one pass,
 * so no replacement is rewritten again by a later row.
 * @param {string} content
 * @param {RewriteContext} context
 */
function rewrite(content, context) {
  return content.replace(claudeText, (match) => {
    const opencode = opencodeText.get(match);
    return typeof opencode === "function" ? opencode(context) : opencode;
  });
}

/**
 * Splits a SKILL.md into its frontmatter and body. It reads the unindented
 * `key: value` lines, with a value optionally wrapped in double quotes, and
 * skips indented lines, such as the entries of a `metadata:` block.
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
 * The OpenCode skill in a directory, with id `rflow:<directory name>` and its
 * content rewritten.
 * @param {string} skillDir absolute skill directory
 * @returns {SkillInfo}
 */
function readSkill(skillDir) {
  const { frontmatter, body } = parseSkillFile(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
  const id = `rflow:${basename(skillDir)}`;
  return {
    id,
    name: frontmatter.name || id,
    description: frontmatter.description,
    autoinvoke: !frontmatter.disableModelInvocation,
    path: join(skillDir, "SKILL.md"),
    content: rewrite(body, { pluginRoot: packageRoot, skillDir }),
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
 * The fields of OpenCode's `Command.Info` that rflow sets.
 * @typedef {object} CommandInfo
 * @property {string} name
 * @property {string} description
 * @property {(input: CommandInvocation) => Promise<unknown>} execute
 */

/**
 * The input of OpenCode's `session.prompt` that rflow sends.
 * @typedef {object} PromptInput
 * @property {string} sessionID
 * @property {"steer" | "queue"} delivery
 * @property {string} text
 * @property {{ id: string }[]} skills
 */

/**
 * @typedef {object} SkillEditor
 * @property {(skill: SkillInfo) => void} add
 */

/**
 * @typedef {object} CommandEditor
 * @property {(command: CommandInfo) => void} add
 */

/**
 * The parts of OpenCode's V2 plugin context rflow uses. An OpenCode older than
 * 2.1 lacks the `skill` or `command` domain.
 * @typedef {object} PluginContext
 * @property {{ transform: (edit: (editor: SkillEditor) => void) => Promise<void> | void }} [skill]
 * @property {{ transform: (edit: (editor: CommandEditor) => void) => Promise<void> | void }} [command]
 * @property {{ prompt: (input: PromptInput) => Promise<unknown> }} session
 */

const versionNote = "rflow needs OpenCode 2.1 or later.";

/**
 * A slash command that prompts the session with the skill attached by id and
 * the typed text as the message, as Claude Code starts a user-invoked skill.
 * @param {PluginContext} ctx
 * @param {SkillInfo} skill
 * @returns {CommandInfo}
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
  /** @param {PluginContext} ctx */
  async setup(ctx) {
    if (typeof ctx?.skill?.transform !== "function") {
      console.warn(`rflow: this OpenCode has no V2 skill domain, so rflow stays inert. ${versionNote}`);
      return;
    }
    const skills = ["skills", "practices"]
      .flatMap((section) => childDirectories(join(packageRoot, section)))
      .map(readSkill);
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill);
    });
    if (typeof ctx.command?.transform !== "function") {
      console.warn(`rflow: this OpenCode has no V2 command domain, so the flows have no slash commands. ${versionNote}`);
      return;
    }
    await ctx.command.transform((editor) => {
      for (const skill of skills) {
        if (!skill.autoinvoke) editor.add(skillCommand(ctx, skill));
      }
    });
  },
};
