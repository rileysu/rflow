// rflow plugin for OpenCode V2 (2.0.4+).
//
// Claude Code consumes this repo as a Claude Code plugin (.claude-plugin/);
// OpenCode consumes it through this file, registered from opencode.jsonc as
// `"plugins": ["/absolute/path/to/rflow"]` (directory form) or installed as a
// git-backed package: "@rileysu/rflow@git+https://github.com/rileysu/rflow.git".
//
// setup() registers every skills/<name>/SKILL.md through ctx.skill.transform()
// so no config `skills` entry or copied skills are needed, rewriting the
// Claude Code variables (${CLAUDE_PLUGIN_ROOT}, ${CLAUDE_SKILL_DIR}) to real
// paths at load time, and appends a short mapping for Claude-Code-only tools
// (EnterWorktree, ExitWorktree, Agent tool). disable-model-invocation in the
// frontmatter becomes autoinvoke: false, matching OpenCode's semantics.
//
// It also registers user-facing commands `/rflow-<flow>` for each flow,
// because OpenCode has no namespaced `/rflow:<flow>` commands.
//
// No external dependencies — plain JavaScript, same approach as
// obra/superpowers (.opencode/plugins/superpowers.js).

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname);
const skillsDir = path.join(pluginRoot, 'skills');

// Simple frontmatter extraction (plain `key: value` lines, quoted values,
// block scalar markers, CRLF), adapted from obra/superpowers. Enough for
// name / description / disable-model-invocation.
const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};
  let lastKey = null;

  for (const rawLine of frontmatterStr.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && !/^\s/.test(line)) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = /^(>[+-]?|\|[+-]?)$/.test(value) ? '' : value;
      lastKey = key;
    } else if (lastKey !== null && line.trim() !== '') {
      frontmatter[lastKey] = `${frontmatter[lastKey]} ${line.trim()}`.trim();
    }
  }

  for (const key of Object.keys(frontmatter)) {
    frontmatter[key] = frontmatter[key].replace(/^(["'])([\s\S]*)\1$/, '$2');
  }

  return { frontmatter, content: body };
};

// Mapping appended to every skill body so prose that names Claude-Code-only
// machinery stays runnable. Keep it short; the per-flow specifics live in the
// skill files themselves.
const OPENCODE_NOTES = `

---

**OpenCode adaptation of Claude-Code-only instructions** (also applies when you read \`references/*.md\` or unconverted prose):

- **EnterWorktree** with the path \`scripts/rflow\` printed: there is no separate worktree-entry tool. Treat the printed directory as the working directory for every later step — pass it to the shell tool's \`workdir\` parameter on each call.
- **ExitWorktree** with action \`keep\`: nothing to call. Simply finish; \`rflow close\` run from the main checkout removes the worktree.
- **Agent tool** (parallel implementers in \`implement-spec\`, lens sub-agents in \`audit\`, review sub-agents): use the \`subagent\` tool instead, with \`agent: "general"\`.
- **Harness-qualified skill names**: \`rflow:finish\` → invoke the skill \`finish\`; \`mattpocock-skills:<name>\` → invoke the skill \`<name>\` (Pocock's skills are installed). Slash commands written \`/rflow:<flow>\` exist here as \`/rflow-<flow>\`.
`;

const rewriteContent = (content, skillDir) =>
  content
    .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot)
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, skillDir)
    .replace(/(?<!\/)rflow:(finish)/g, '$1')
    .replace(/(?<!\/)\bmattpocock-skills:/g, '')
    .replace(/\/rflow:/g, '/rflow-')
    .replace(/\/mattpocock-skills:/g, '@')
    .concat(OPENCODE_NOTES);

const loadSkills = () => {
  if (!fs.existsSync(skillsDir)) {
    console.error('[rflow] no skills directory at', skillsDir);
    return [];
  }
  const skills = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const { frontmatter, content } = extractAndStripFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    skills.push({
      id: entry.name,
      name: frontmatter.name || entry.name,
      ...(frontmatter.description ? { description: frontmatter.description } : {}),
      ...(frontmatter['disable-model-invocation'] === 'true' ? { autoinvoke: false } : {}),
      path: skillPath,
      content: rewriteContent(content, path.join(skillsDir, entry.name)),
    });
  }
  return skills;
};

async function setup(ctx) {
  // Fail-closed shape check (mirrors superpowers): without the skill domain we
  // are not on a V2 host; do nothing rather than crash plugin loading.
  if (!ctx || !ctx.skill || typeof ctx.skill.transform !== 'function') {
    console.error('[rflow] V2 ctx.skill.transform unavailable; plugin inert');
    return;
  }

  const skills = loadSkills();

  try {
    await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        try {
          editor.add(skill);
        } catch (err) {
          console.error(`[rflow] skill "${skill.id}" rejected by host, skipping:`, err);
        }
      }
    });
    console.log(`[rflow] registered ${skills.length} skills: ${skills.map((s) => s.id).join(', ')}`);
  } catch (err) {
    console.error('[rflow] skill registration failed:', err);
  }

  // User-invoked flows as slash commands: /rflow-grill, /rflow-finish, ...
  // (only after the skill domain succeeded; commands are a convenience layer).
  if (ctx.command && typeof ctx.command.transform === 'function') {
    try {
      await ctx.command.transform((editor) => {
        for (const skill of skills) {
          editor.add({
            name: `rflow-${skill.id}`,
            description: `rflow flow: ${skill.description ?? skill.id}`,
            execute: async ({ sessionID, prompt, delivery }) => {
              await ctx.session.prompt({
                ...prompt,
                sessionID,
                delivery,
                text: `Use the skill tool to load the "${skill.id}" skill and follow it fully.\n\n${
                  prompt && prompt.text ? `Arguments: ${prompt.text}` : ''
                }`.trim(),
              });
            },
          });
        }
      });
      console.log(
        `[rflow] registered ${skills.length} commands: ${skills.map((s) => `rflow-${s.id}`).join(', ')}`,
      );
    } catch (err) {
      console.error('[rflow] command registration failed:', err);
    }
  }
}

export default {
  id: 'rflow',
  setup,
};
