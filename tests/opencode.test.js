// Tests the OpenCode plugin through the seam a harness sees: `setup` called
// with a fake `ctx` that records what each domain's `transform` receives.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import plugin from "../opencode/plugin.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A fake V2 `ctx` whose `skill.transform` and `command.transform` record every
 * skill and command added, and whose `session.prompt` records every prompt.
 */
function fakeContext() {
  /** @type {Array<Record<string, unknown>>} */
  const skills = [];
  /** @type {Array<Record<string, any>>} */
  const commands = [];
  /** @type {Array<Record<string, unknown>>} */
  const prompts = [];
  const skillEditor = {
    list: () => skills,
    get: (id) => skills.find((skill) => skill.id === id),
    add: (skill) => skills.push(skill),
    update: () => {},
    remove: () => {},
  };
  const commandEditor = { add: (command) => commands.push(command) };
  const transform = (editor) => async (callback) => {
    callback(editor);
    return { dispose: async () => {} };
  };
  const ctx = {
    skill: { transform: transform(skillEditor) },
    command: { transform: transform(commandEditor) },
    session: {
      prompt: async (input) => {
        prompts.push(input);
      },
    },
  };
  return { ctx, skills, commands, prompts };
}

/** Runs `setup` and returns the recorded skills keyed by id. */
async function registeredSkills() {
  const { ctx, skills } = fakeContext();
  await plugin.setup(ctx);
  return new Map(skills.map((skill) => [skill.id, skill]));
}

/** Runs `setup` and returns the recorded commands keyed by name, and the prompts they send. */
async function registeredCommands() {
  const { ctx, commands, prompts } = fakeContext();
  await plugin.setup(ctx);
  return { commands: new Map(commands.map((command) => [command.name, command])), prompts };
}

/** Each rflow skill's name mapped to its SKILL.md path, from both sections of the tree. */
const rflowSkillFiles = new Map(
  ["skills", "practices"].flatMap((section) =>
    readdirSync(join(repoRoot, section)).map((name) => [name, join(repoRoot, section, name, "SKILL.md")]),
  ),
);
const rflowSkillNames = [...rflowSkillFiles.keys()];

before(() => {
  // OpenCode starts plugins from the user's project, never the plugin root.
  process.chdir(tmpdir());
});

test("the default export is the V2 plugin shape with id rflow", () => {
  assert.equal(plugin.id, "rflow");
  assert.equal(typeof plugin.setup, "function");
});

test("every rflow skill registers as rflow:<directory name> with its description and real SKILL.md path", async () => {
  const skills = await registeredSkills();

  assert.equal(skills.size, 22);
  assert.deepEqual(
    [...skills.keys()].sort(),
    rflowSkillNames.map((name) => `rflow:${name}`).sort(),
  );
  for (const name of rflowSkillNames) {
    const skill = skills.get(`rflow:${name}`);
    assert.equal(skill.name, name);
    assert.equal(skill.path, rflowSkillFiles.get(name));
    assert.ok(typeof skill.description === "string" && skill.description.length > 0);
  }
  assert.equal(
    skills.get("rflow:finish").description,
    "Ship the current rflow worktree as a pull request or local merge, then remove it. Use when an rflow flow's work is committed and ready to ship.",
  );
  assert.equal(
    skills.get("rflow:wayfinder").description,
    "Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on GitHub, and resolve them one at a time in docs worktrees until the way to the destination is clear.",
  );
});

test("rflow skills register from both skills/ and practices/, and finish lives only in practices/", async () => {
  const skills = await registeredSkills();

  assert.equal(skills.get("rflow:grill").path, join(repoRoot, "skills", "grill", "SKILL.md"));
  assert.equal(skills.get("rflow:finish").path, join(repoRoot, "practices", "finish", "SKILL.md"));
  assert.ok(!existsSync(join(repoRoot, "skills", "finish")));
});

test("user-invoked rflow skills carry autoinvoke false and rflow:finish does not", async () => {
  const skills = await registeredSkills();

  for (const name of rflowSkillNames) {
    const skillFile = readFileSync(rflowSkillFiles.get(name), "utf8");
    const userInvoked = /^disable-model-invocation: true$/m.test(skillFile);
    assert.equal(skills.get(`rflow:${name}`).autoinvoke === false, userInvoked, `rflow:${name}`);
  }
  assert.notEqual(skills.get("rflow:finish").autoinvoke, false);
  assert.equal(skills.get("rflow:grill").autoinvoke, false);
});

test("every skill named in a Skill tool call is a registered id", async () => {
  const skills = await registeredSkills();
  const skillToolCall = /Skill tool (?:with|twice, for) (["`])([^"`]+)\1(?: and (["`])([^"`]+)\3)?/g;
  let calls = 0;

  for (const skill of skills.values()) {
    for (const call of skill.content.matchAll(skillToolCall)) {
      for (const id of [call[2], call[4]].filter(Boolean)) {
        assert.ok(skills.has(id), `${skill.id} calls the Skill tool with unregistered ${id}`);
        calls += 1;
      }
    }
  }
  assert.ok(calls >= 20, `found ${calls} Skill tool calls`);
  assert.match(skills.get("rflow:wayfinder").content, /Skill tool with "rflow:prototype"/);
  assert.match(skills.get("rflow:wayfinder").content, /Skill tool twice, for "rflow:grilling" and "rflow:domain-modeling"/);
  assert.match(skills.get("rflow:grill").content, /Skill tool twice, for `rflow:grilling` and `rflow:domain-modeling`/);
  assert.match(skills.get("rflow:investigate").content, /Skill tool twice, for `rflow:diagnosing-bugs` and `rflow:domain-modeling`/);
  assert.match(skills.get("rflow:implement-ticket").content, /Skill tool with `rflow:tdd`/);
  assert.match(skills.get("rflow:finish").content, /Skill tool, calling `rflow:pr`/);
  assert.match(skills.get("rflow:wayfinder").content, /Skill tool with `rflow:research`/);
});

test("no registered skill or shared reference holds a mattpocock-skills id", async () => {
  const skills = await registeredSkills();
  const pocockId = /mattpocock-skills/;

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.id, pocockId);
    assert.doesNotMatch(skill.content, pocockId, skill.id);
  }
  for (const name of readdirSync(join(repoRoot, "references"))) {
    assert.doesNotMatch(readFileSync(join(repoRoot, "references", name), "utf8"), pocockId, name);
  }
  assert.match(skills.get("rflow:audit").content, /The lens is `rflow:diagnosing-bugs`/);
  assert.match(skills.get("rflow:audit").content, /The lens is `rflow:codebase-design`/);
  assert.match(skills.get("rflow:audit").content, /The lens is `rflow:domain-modeling`/);
  assert.match(
    readFileSync(join(repoRoot, "references", "review-loop.md"), "utf8"),
    /Skill tool with `rflow:code-review`/,
  );
});

test("a ctx without skill.transform makes setup log one line and return", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const log = t.mock.method(console, "log", () => {});
  const error = t.mock.method(console, "error", () => {});

  for (const ctx of [{}, { skill: {} }]) {
    await plugin.setup(ctx);
  }

  const lines = [...warn.mock.calls, ...log.mock.calls, ...error.mock.calls];
  assert.equal(lines.length, 2);
  for (const call of lines) {
    assert.equal(call.arguments.length, 1);
    assert.doesNotMatch(String(call.arguments[0]), /\n/);
  }
});

test("no registered content contains ${CLAUDE_, and every substituted path exists", async () => {
  const skills = await registeredSkills();
  const pluginPath = new RegExp(`${repoRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[\\w./-]+`, "g");
  let scriptCalls = 0;

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.content, /\$\{CLAUDE_/, skill.id);
    for (const [path] of skill.content.matchAll(pluginPath)) {
      assert.ok(existsSync(path), `${skill.id} names missing ${path}`);
      if (path.endsWith("/scripts/rflow")) {
        accessSync(path, constants.X_OK);
        scriptCalls += 1;
      }
    }
  }
  assert.ok(scriptCalls >= 30, `found ${scriptCalls} script calls`);
  assert.ok(
    skills.get("rflow:setup").content.includes(join(repoRoot, "skills", "setup", "settings.json")),
  );
});

test("implement-spec starts each implementer as a background subagent in a worktree under .claude/worktrees", async () => {
  const skills = await registeredSkills();
  const implementSpec = skills.get("rflow:implement-spec").content;

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.content, /isolation: "worktree"/, skill.id);
  }
  assert.match(
    implementSpec,
    /`git worktree add -b 'worktree-agent-<ticket number>' -- '<main_checkout>\/\.claude\/worktrees\/agent-<ticket number>' '<branch>'`/,
  );
  assert.match(implementSpec, /`subagent` tool with `background: true`/);
  assert.match(implementSpec, /`session_move` through `execute` with `directory` set to that worktree/);
  assert.match(
    implementSpec,
    /Once all tickets are merged, clean up all \*\*implementer subagent\*\* worktrees and branches\./,
  );
});

test("audit and wayfinder start their subagents through OpenCode's subagent tool", async () => {
  const skills = await registeredSkills();

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.content, /Agent call/, skill.id);
  }
  assert.match(skills.get("rflow:audit").content, /one `subagent` tool call each/);
  assert.match(
    skills.get("rflow:wayfinder").content,
    /one `subagent` tool call with `background: true` for it/,
  );
});

test("no registered skill names EnterWorktree or ExitWorktree", async () => {
  const skills = await registeredSkills();

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.content, /EnterWorktree|ExitWorktree/, skill.id);
  }
});

test("flows that open a worktree move the session into the printed path through execute", async () => {
  const skills = await registeredSkills();
  const opening = ["grill", "investigate", "setup", "audit", "implement-spec", "implement-ticket", "tweak-pr", "review-pr", "wayfinder"];

  for (const name of opening) {
    assert.match(
      skills.get(`rflow:${name}`).content,
      /`session_move` through `execute` with `directory` set to the printed path/,
      name,
    );
  }
});

test("flows that close a worktree move the session back to the main checkout first", async () => {
  const skills = await registeredSkills();

  for (const name of ["finish", "review-pr", "audit", "tweak-pr"]) {
    assert.match(
      skills.get(`rflow:${name}`).content,
      /`session_move` through `execute` with `directory` set to the main checkout/,
      name,
    );
  }
  assert.match(
    skills.get("rflow:finish").content,
    /`session_move` through `execute` with `directory` set to the main checkout when this session moved into the worktree earlier, so that `git merge` runs from the main checkout\./,
  );
});

test("each user-invoked skill has a command of the same name and model-invoked skills have none", async () => {
  const skills = await registeredSkills();
  const { commands } = await registeredCommands();

  const userInvoked = [...skills.values()].filter((skill) => skill.autoinvoke === false);
  assert.deepEqual(
    [...commands.keys()].sort(),
    userInvoked.map((skill) => skill.id).sort(),
  );
  for (const skill of userInvoked) {
    assert.equal(commands.get(skill.id).description, skill.description, skill.id);
  }
  assert.ok(commands.has("rflow:grill"));
  assert.ok(commands.has("rflow:tweak-pr"));
  assert.ok(!commands.has("rflow:finish"));
});

test("to-spec and to-tickets register as user-invoked rflow skills with slash commands", async () => {
  const skills = await registeredSkills();
  const { commands } = await registeredCommands();

  for (const name of ["to-spec", "to-tickets"]) {
    const skill = skills.get(`rflow:${name}`);
    assert.equal(skill.path, join(repoRoot, "skills", name, "SKILL.md"));
    assert.equal(skill.autoinvoke, false, name);
    assert.ok(commands.has(`rflow:${name}`), name);
  }
});

test("to-spec and to-tickets point setup to /rflow:setup and apply ready-for-agent with no label vocabulary", async () => {
  const skills = await registeredSkills();

  for (const name of ["to-spec", "to-tickets"]) {
    const { content } = skills.get(`rflow:${name}`);
    assert.match(content, /tell the user to run `\/rflow:setup`/, name);
    assert.doesNotMatch(content, /setup-matt-pocock-skills/, name);
    assert.doesNotMatch(content, /label vocabulary/, name);
    assert.match(content, /Apply the `ready-for-agent` triage label/, name);
  }
  assert.match(skills.get("rflow:to-tickets").content, /`\.scratch\/<feature-slug>\/issues\/<NN>-<slug>\.md`/);
});

// The plugin rewrites only SKILL.md, so a supporting file reaches OpenCode as written.
const claudeOnly = /\$\{CLAUDE_|\$ARGUMENTS|EnterWorktree|ExitWorktree|isolation: "worktree"|Agent call|mattpocock-skills|setup-matt-pocock-skills/;

const setupTemplate = (name) => readFileSync(join(repoRoot, "skills", "setup", name), "utf8");

test("setup's tracker template is the GitHub doc, with the operations flows read and no triage surface", () => {
  const tracker = setupTemplate("issue-tracker-github.md");

  assert.match(tracker, /^# Issue tracker: GitHub\n/);
  assert.match(tracker, /\*\*Apply \/ remove labels\*\*/);
  assert.match(tracker, /## Wayfinding operations\n\nUsed by `\/rflow:wayfinder`\./);
  assert.doesNotMatch(tracker, /triage|request surface/i);
  assert.doesNotMatch(tracker, claudeOnly);
});

test("setup's domain template describes only the single-context layout and names rflow:domain-modeling", () => {
  const domain = setupTemplate("domain.md");

  assert.match(domain, /\*\*`GLOSSARY\.md`\*\* at the repo root/);
  assert.match(domain, /\*\*`docs\/adr\/`\*\*/);
  assert.match(domain, /The `rflow:domain-modeling` skill creates them lazily/);
  assert.doesNotMatch(domain, /GLOSSARY-MAP|multi-context|src\/<context>|src\/ordering/i);
  assert.doesNotMatch(domain, /\/domain-modeling|grill-with-docs|improve-codebase-architecture/);
  assert.doesNotMatch(domain, claudeOnly);
});

test("setup opens with a header naming the upstream setup skill at the v1.3.1 commit", async () => {
  const skills = await registeredSkills();

  assert.match(
    skills.get("rflow:setup").content.trimStart(),
    /^<!-- Adapted from mattpocock\/skills skills\/engineering\/setup-matt-pocock-skills\/SKILL\.md and its supporting files at 24fe0ef \(v1\.3\.1\)\. MIT License, Copyright \(c\) 2026 Matt Pocock\. rflow [^\n]+ -->\n/,
  );
});

test("setup runs settings, docs, labels and commit in order, then calls rflow:finish", async () => {
  const skills = await registeredSkills();
  const { content } = skills.get("rflow:setup");
  const skillDir = join(repoRoot, "skills", "setup");
  const steps = [
    `scripts/rflow" open --no-tracker chore 'rflow setup'`,
    `scripts/rflow" settings "${join(skillDir, "settings.json")}"`,
    `scripts/rflow" settings "${join(skillDir, "opencode.json")}"`,
    `cp "${join(skillDir, "issue-tracker-github.md")}" docs/agents/issue-tracker.md`,
    `cp "${join(skillDir, "domain.md")}" docs/agents/domain.md`,
    "## Agent skills",
    `scripts/rflow" docs`,
    `scripts/rflow" labels`,
    "git commit",
    "Skill tool with `rflow:finish`",
  ];
  let from = 0;

  for (const step of steps) {
    const at = content.indexOf(step, from);
    assert.ok(at >= 0, `missing or out of order: ${step}`);
    from = at + step.length;
  }
});

test("setup has no typed, draft or confirm step, and states its choices for the pull request", async () => {
  const skills = await registeredSkills();
  const body = skills.get("rflow:setup").content.replace(/^\s*<!--.*?-->/s, "");

  assert.doesNotMatch(body, /tell the user|to type|draft|confirm/i);
  assert.match(body, /states? (?:both|these|its) choices/);
  assert.match(body, /`rflow:domain-modeling`/);
});

test("setup's Agent skills block has the tracker and domain docs and no triage labels", async () => {
  const skills = await registeredSkills();
  const body = skills.get("rflow:setup").content.replace(/^\s*<!--.*?-->/s, "");
  // The block sits in a fenced code block indented under its numbered step.
  const [, indented] = body.match(/```markdown\n( *## Agent skills\n[\s\S]*?)```/) ?? [];

  assert.ok(indented, "setup holds the block");
  const block = indented.replace(/^ +/gm, "");
  assert.deepEqual(block.match(/^#+ .+$/gm), ["## Agent skills", "### Issue tracker", "### Domain docs"]);
  assert.match(block, /See `docs\/agents\/issue-tracker\.md`\./);
  assert.match(block, /Single-context[^\n]*See `docs\/agents\/domain\.md`\./);
  assert.doesNotMatch(body, /triage/i);
});

test("the README's setup row shows nothing for the user to type", () => {
  const row = readFileSync(join(repoRoot, "README.md"), "utf8")
    .split("\n")
    .find((line) => line.startsWith("| `/rflow:setup` |"));

  assert.ok(row, "the flows table has a setup row");
  assert.equal(row.split("|").at(-2).trim(), "Nothing");
  assert.doesNotMatch(row, /Pocock|mattpocock/);
});

/**
 * One practice copied from Pocock's package, as the ticket lists them.
 * @typedef {object} PracticeCopy
 * @property {string} name
 * @property {string} upstream its directory in mattpocock/skills
 * @property {string[]} files every file the copy ships, relative to its directory
 */

/** @type {readonly PracticeCopy[]} */
const practiceCopies = [
  { name: "grilling", upstream: "skills/productivity/grilling", files: ["SKILL.md"] },
  {
    name: "domain-modeling",
    upstream: "skills/engineering/domain-modeling",
    files: ["ADR-FORMAT.md", "GLOSSARY-FORMAT.md", "SKILL.md"],
  },
  {
    name: "diagnosing-bugs",
    upstream: "skills/engineering/diagnosing-bugs",
    files: ["SKILL.md", "scripts/hitl-loop.template.sh"],
  },
  {
    name: "codebase-design",
    upstream: "skills/engineering/codebase-design",
    files: ["DEEPENING.md", "DESIGN-IT-TWICE.md", "SKILL.md"],
  },
  { name: "code-review", upstream: "skills/engineering/code-review", files: ["SKILL.md"] },
  { name: "tdd", upstream: "skills/engineering/tdd", files: ["SKILL.md", "mocking.md", "tests.md"] },
  { name: "pr", upstream: "skills/engineering/pr", files: ["CREDITS.md", "SKILL.md"] },
  { name: "research", upstream: "skills/engineering/research", files: ["SKILL.md"] },
  {
    name: "prototype",
    upstream: "skills/engineering/prototype",
    files: ["LOGIC.md", "SKILL.md", "UI.md"],
  },
  {
    name: "writing-for-agents",
    upstream: "skills/productivity/writing-for-agents",
    files: ["SKILL-MECHANICS.md", "SKILL.md"],
  },
];

test("the 10 copied practices register as autoinvoked rflow skills from practices/, with no slash command", async () => {
  const skills = await registeredSkills();
  const { commands } = await registeredCommands();

  for (const { name } of practiceCopies) {
    const skill = skills.get(`rflow:${name}`);
    assert.ok(skill, name);
    assert.equal(skill.path, join(repoRoot, "practices", name, "SKILL.md"));
    assert.equal(skill.autoinvoke, true, name);
    assert.ok(!commands.has(`rflow:${name}`), name);
  }
});

test("each copied practice opens with a header naming its upstream path, the v1.3.1 commit, the licence and rflow's changes", async () => {
  const skills = await registeredSkills();

  for (const { name, upstream } of practiceCopies) {
    assert.match(
      skills.get(`rflow:${name}`).content.trimStart(),
      new RegExp(
        `^<!-- Adapted from mattpocock/skills ${upstream}/SKILL\\.md(?: and its supporting files)? at 24fe0ef \\(v1\\.3\\.1\\)\\. MIT License, Copyright \\(c\\) 2026 Matt Pocock\\. rflow [^\\n]+ -->\\n`,
      ),
      name,
    );
  }
});

test("copied practices name other skills by rflow id and point setup to /rflow:setup", async () => {
  const skills = await registeredSkills();

  assert.match(skills.get("rflow:tdd").content, /call the Skill tool with "rflow:codebase-design" for the vocabulary/);
  assert.match(skills.get("rflow:tdd").content, /see the `rflow:code-review` skill/);
  assert.match(skills.get("rflow:code-review").content, /tell the user to run `\/rflow:setup`/);
});

test("every file of the copied practices is free of Claude-only text and Pocock ids, supporting files included", () => {
  for (const { name, files } of practiceCopies) {
    for (const file of files) {
      assert.doesNotMatch(readFileSync(join(repoRoot, "practices", name, file), "utf8"), claudeOnly, `${name}/${file}`);
    }
  }
});

test("a command's execute prompts the session with its skill attached and the typed text as the message", async () => {
  const { commands, prompts } = await registeredCommands();

  await commands.get("rflow:tweak-pr").execute({
    sessionID: "ses_1",
    prompt: { text: "42 rename the flag" },
    delivery: "steer",
  });
  await commands.get("rflow:grill").execute({
    sessionID: "ses_2",
    prompt: { text: "caching", skills: [{ id: "rflow:finish" }] },
    delivery: "queue",
  });

  assert.deepEqual(prompts, [
    {
      sessionID: "ses_1",
      text: "42 rename the flag",
      skills: [{ id: "rflow:tweak-pr" }],
      delivery: "steer",
    },
    {
      sessionID: "ses_2",
      text: "caching",
      skills: [{ id: "rflow:finish" }, { id: "rflow:grill" }],
      delivery: "queue",
    },
  ]);
});

test("no registered content contains $ARGUMENTS, and flows read the text typed after the command", async () => {
  const skills = await registeredSkills();

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.content, /\$ARGUMENTS/, skill.id);
  }
  assert.match(
    skills.get("rflow:grill").content,
    /The topic is the text typed after the command\. Ask for one if it is empty\./,
  );
  assert.match(
    skills.get("rflow:tweak-pr").content,
    /The text typed after the command holds the pull request, a number or URL, as its first word/,
  );
});

test("a ctx without command.transform registers the skills and skips the commands with one logged line", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const log = t.mock.method(console, "log", () => {});
  const error = t.mock.method(console, "error", () => {});

  for (const command of [undefined, {}]) {
    const { ctx, skills } = fakeContext();
    await plugin.setup({ ...ctx, command });
    assert.ok(skills.some((skill) => skill.id === "rflow:grill"));
  }

  const lines = [...warn.mock.calls, ...log.mock.calls, ...error.mock.calls];
  assert.equal(lines.length, 2);
  for (const call of lines) {
    assert.equal(call.arguments.length, 1);
    assert.doesNotMatch(String(call.arguments[0]), /\n/);
  }
});

test("package.json and .claude-plugin/plugin.json agree on version", () => {
  const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));

  assert.equal(readJson("package.json").version, readJson(".claude-plugin/plugin.json").version);
});

test("the packed package declares no mattpocock-skills dependency", () => {
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: repoRoot, encoding: "utf8" }),
  );
  const lockfile = JSON.parse(readFileSync(join(repoRoot, "package-lock.json"), "utf8"));

  assert.ok(pack.files.some((file) => file.path === "package.json"));
  assert.equal(JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).dependencies, undefined);
  assert.deepEqual(Object.keys(lockfile.packages), [""]);
  assert.equal(lockfile.packages[""].dependencies, undefined);
});

test("no Claude Code manifest or repo setting names the mattpocock marketplace", () => {
  const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  const plugin = readJson(".claude-plugin/plugin.json");
  const marketplace = readJson(".claude-plugin/marketplace.json");

  assert.equal(plugin.dependencies, undefined);
  assert.equal(marketplace.allowCrossMarketplaceDependenciesOn, undefined);
  assert.deepEqual(Object.keys(readJson(".claude/settings.json").extraKnownMarketplaces), ["rflow"]);
  for (const { keywords } of [plugin, readJson("package.json")]) {
    assert.ok(!keywords.includes("mattpocock"));
  }
});

test("the packed plugin holds skills/, practices/, references/ and an executable scripts/rflow", () => {
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: repoRoot, encoding: "utf8" }),
  );
  const modes = new Map(pack.files.map((file) => [file.path, file.mode]));

  assert.ok(modes.has("skills/grill/SKILL.md"));
  assert.ok(modes.has("skills/setup/settings.json"));
  assert.ok(modes.has("skills/setup/issue-tracker-github.md"));
  assert.ok(modes.has("skills/setup/domain.md"));
  assert.ok(modes.has("practices/finish/SKILL.md"));
  assert.ok(modes.has("references/handoff.md"));
  assert.ok(modes.has("opencode/plugin.js"));
  assert.equal(modes.get("scripts/rflow") & 0o111, 0o111, "scripts/rflow is executable");
});

test("the packed plugin holds each copied practice with exactly its supporting files and no agents/openai.yaml", () => {
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: repoRoot, encoding: "utf8" }),
  );
  const paths = pack.files.map((file) => file.path);

  for (const { name, files } of practiceCopies) {
    assert.deepEqual(
      paths.filter((path) => path.startsWith(`practices/${name}/`)).sort(),
      files.map((file) => `practices/${name}/${file}`).sort(),
      name,
    );
  }
  assert.deepEqual(paths.filter((path) => path.endsWith("openai.yaml")), []);
});
