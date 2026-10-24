// Tests the OpenCode plugin through the seam a harness sees: `setup` called
// with a fake `ctx` that records what each domain's `transform` receives.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import plugin from "../opencode/plugin.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A fake V2 `ctx` whose `skill.transform` records every skill added. */
function fakeContext() {
  /** @type {Array<Record<string, unknown>>} */
  const skills = [];
  const editor = {
    list: () => skills,
    get: (id) => skills.find((skill) => skill.id === id),
    add: (skill) => skills.push(skill),
    update: () => {},
    remove: () => {},
  };
  const ctx = {
    skill: {
      transform: async (callback) => {
        callback(editor);
        return { dispose: async () => {} };
      },
    },
  };
  return { ctx, skills };
}

/** Runs `setup` and returns the recorded skills keyed by id. */
async function registeredSkills() {
  const { ctx, skills } = fakeContext();
  await plugin.setup(ctx);
  return new Map(skills.map((skill) => [skill.id, skill]));
}

const rflowSkillNames = readdirSync(join(repoRoot, "skills"));

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

  assert.deepEqual(
    [...skills.keys()].filter((id) => id.startsWith("rflow:")).sort(),
    rflowSkillNames.map((name) => `rflow:${name}`).sort(),
  );
  for (const name of rflowSkillNames) {
    const skill = skills.get(`rflow:${name}`);
    assert.equal(skill.name, name);
    assert.equal(skill.path, join(repoRoot, "skills", name, "SKILL.md"));
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

test("user-invoked rflow skills carry autoinvoke false and rflow:finish does not", async () => {
  const skills = await registeredSkills();

  for (const name of rflowSkillNames) {
    const skillFile = readFileSync(join(repoRoot, "skills", name, "SKILL.md"), "utf8");
    const userInvoked = /^disable-model-invocation: true$/m.test(skillFile);
    assert.equal(skills.get(`rflow:${name}`).autoinvoke === false, userInvoked, `rflow:${name}`);
  }
  assert.notEqual(skills.get("rflow:finish").autoinvoke, false);
  assert.equal(skills.get("rflow:grill").autoinvoke, false);
});

const pocockRoot = join(repoRoot, "node_modules", "mattpocock-skills");
const pocockSkillDirs = JSON.parse(
  readFileSync(join(pocockRoot, ".claude-plugin", "plugin.json"), "utf8"),
).skills.map((path) => join(pocockRoot, path));

test("exactly the skills Pocock's Claude plugin manifest lists register as mattpocock-skills:<name>", async () => {
  const skills = await registeredSkills();

  assert.deepEqual(
    [...skills.keys()].filter((id) => id.startsWith("mattpocock-skills:")).sort(),
    pocockSkillDirs.map((dir) => `mattpocock-skills:${basename(dir)}`).sort(),
  );
  for (const dir of pocockSkillDirs) {
    const skill = skills.get(`mattpocock-skills:${basename(dir)}`);
    assert.equal(skill.path, join(dir, "SKILL.md"));
    assert.ok(typeof skill.description === "string" && skill.description.length > 0, skill.id);
  }
  assert.ok(skills.has("mattpocock-skills:tdd"));
  assert.ok(skills.has("mattpocock-skills:to-tickets"));
  assert.ok(!skills.has("mattpocock-skills:in-progress"));
});

test("user-invoked Pocock skills carry autoinvoke false and model-invoked ones do not", async () => {
  const skills = await registeredSkills();

  for (const dir of pocockSkillDirs) {
    const skillFile = readFileSync(join(dir, "SKILL.md"), "utf8");
    const userInvoked = /^disable-model-invocation: true$/m.test(skillFile);
    const id = `mattpocock-skills:${basename(dir)}`;
    assert.equal(skills.get(id).autoinvoke === false, userInvoked, id);
  }
  assert.equal(skills.get("mattpocock-skills:to-tickets").autoinvoke, false);
  assert.equal(skills.get("mattpocock-skills:to-spec").autoinvoke, false);
  assert.notEqual(skills.get("mattpocock-skills:tdd").autoinvoke, false);
  assert.notEqual(skills.get("mattpocock-skills:grilling").autoinvoke, false);
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
  assert.match(skills.get("mattpocock-skills:grill-me").content, /Skill tool with "mattpocock-skills:grilling"/);
  assert.match(skills.get("mattpocock-skills:implement-spec").content, /Skill tool with `mattpocock-skills:tdd`/);
  assert.match(
    skills.get("mattpocock-skills:grill-with-docs").content,
    /Skill tool twice, for "mattpocock-skills:grilling" and "mattpocock-skills:domain-modeling"/,
  );
  assert.match(skills.get("rflow:wayfinder").content, /Skill tool with "mattpocock-skills:prototype"/);
});

test("every Pocock slash command told to the user names a user-invoked skill by its id", async () => {
  const skills = await registeredSkills();
  const userInvokedPocockNames = pocockSkillDirs
    .filter((dir) => skills.get(`mattpocock-skills:${basename(dir)}`).autoinvoke === false)
    .map((dir) => basename(dir));
  const bareCommand = new RegExp(`(?<![^\\s\`(])/(?:${userInvokedPocockNames.join("|")})(?![\\w:/-])`);
  let commands = 0;

  for (const skill of skills.values()) {
    assert.doesNotMatch(skill.content, bareCommand, skill.id);
    for (const [, id] of skill.content.matchAll(/\/(mattpocock-skills:[\w-]+)/g)) {
      assert.equal(skills.get(id)?.autoinvoke, false, `${skill.id} tells the user to run /${id}`);
      commands += 1;
    }
  }
  assert.ok(commands >= 20, `found ${commands} Pocock slash commands`);
  assert.match(
    skills.get("mattpocock-skills:code-review").content,
    /tell the user to run `\/mattpocock-skills:setup-matt-pocock-skills`/,
  );
  assert.match(
    skills.get("mattpocock-skills:ask-matt").content,
    /\*\*`\/mattpocock-skills:to-spec`\*\* \(turn the thread into a spec\), then \*\*`\/mattpocock-skills:to-tickets`\*\*/,
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
  assert.match(implementSpec, /`git worktree add -b [^`]+ <main_checkout>\/\.claude\/worktrees\/[^`]+`/);
  assert.match(implementSpec, /`subagent` tool with `background: true`/);
  assert.match(implementSpec, /`session_move` with `directory` set to that worktree/);
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

test("package.json and .claude-plugin/plugin.json agree on version", () => {
  const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));

  assert.equal(readJson("package.json").version, readJson(".claude-plugin/plugin.json").version);
});

test("package.json and .claude-plugin/plugin.json pin mattpocock-skills to the same range", () => {
  const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
  const npmSpec = readJson("package.json").dependencies["mattpocock-skills"];
  const claudeDependency = readJson(".claude-plugin/plugin.json").dependencies.find(
    (dependency) => dependency.name === "mattpocock-skills",
  );

  assert.match(npmSpec, /^github:mattpocock\/skills#semver:/);
  assert.equal(npmSpec.replace(/^github:mattpocock\/skills#semver:/, ""), claudeDependency.version);
  assert.equal(claudeDependency.version, "^1.3");
});

test("the packed plugin holds skills/, references/ and an executable scripts/rflow", () => {
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: repoRoot, encoding: "utf8" }),
  );
  const modes = new Map(pack.files.map((file) => [file.path, file.mode]));

  assert.ok(modes.has("skills/grill/SKILL.md"));
  assert.ok(modes.has("skills/setup/settings.json"));
  assert.ok(modes.has("references/handoff.md"));
  assert.ok(modes.has("opencode/plugin.js"));
  assert.equal(modes.get("scripts/rflow") & 0o111, 0o111, "scripts/rflow is executable");
});
