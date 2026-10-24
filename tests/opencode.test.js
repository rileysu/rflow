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
      /`session_move` with `directory` set to the main checkout/,
      name,
    );
  }
  assert.match(
    skills.get("rflow:finish").content,
    /`session_move` with `directory` set to the main checkout when this session moved into the worktree earlier, so that `git merge` runs from the main checkout\./,
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
