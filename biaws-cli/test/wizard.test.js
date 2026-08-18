import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  ProgrammedPromptAdapter,
  PromptCancelledError,
} from "../src/core/prompts.js";
import {
  buildExecutionPlan,
  confirmExecutionPlan,
  executeExecutionPlan,
  normalizeWizardOptions,
  summarizeExecutionPlan,
  wizardFlags,
} from "../src/core/wizard.js";

function terminal(isInteractive = true) {
  return {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    isInteractive,
  };
}

const definition = {
  kind: "instance.setup",
  questions: [
    {
      name: "name",
      type: "input",
      message: "Nome",
      environment: "BIAWS_INSTANCE",
      validate: (value) => value !== "invalid" || "Nome inválido.",
    },
    {
      name: "storage",
      type: "select",
      message: "Storage",
      choices: [
        { name: "Volume", value: "volume" },
        { name: "Diretório", value: "directory" },
      ],
      default: "volume",
    },
    {
      name: "directory",
      type: "input",
      message: "Diretório",
      when: (values) => values.storage === "directory",
    },
    {
      name: "password",
      type: "password",
      message: "Senha",
      secret: true,
    },
    {
      name: "demo",
      type: "confirm",
      message: "Demo",
      default: false,
    },
  ],
};

test("flags skip prompts and conditional questions use programmed responses", async () => {
  const prompts = new ProgrammedPromptAdapter({
    storage: "directory",
    directory: "/srv/biaws",
    password: "private-value",
    demo: true,
  });
  const plan = await buildExecutionPlan(definition, {
    flags: { name: "local" },
    options: { interactive: true },
    promptAdapter: prompts,
    terminal: terminal(),
  });

  assert.deepEqual(prompts.questions, [
    "storage",
    "directory",
    "password",
    "demo",
  ]);
  assert.equal(plan.get("name"), "local");
  assert.equal(plan.get("directory"), "/srv/biaws");
  assert.equal(plan.get("password"), "private-value");
  assert.deepEqual(summarizeExecutionPlan(plan), {
    kind: "instance.setup",
    values: {
      name: "local",
      storage: "directory",
      directory: "/srv/biaws",
      password: "[REDACTED]",
      demo: true,
    },
  });
  assert.equal(JSON.stringify(plan).includes("private-value"), false);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.values), true);
});

test("non-interactive mode lists every missing applicable field without implicit defaults", async () => {
  await assert.rejects(
    buildExecutionPlan(definition, {
      flags: { name: "local", password: "private-value" },
      options: { nonInteractive: true },
      terminal: terminal(false),
    }),
    (error) => {
      assert.equal(error.code, "MISSING_REQUIRED_INPUT");
      assert.deepEqual(error.fields, ["storage", "demo"]);
      return true;
    },
  );
});

test("--defaults is opt-in and works without a TTY", async () => {
  const plan = await buildExecutionPlan(definition, {
    environment: { BIAWS_INSTANCE: "from-env" },
    flags: { password: "private-value" },
    options: { defaults: true, nonInteractive: true },
    terminal: terminal(false),
  });

  assert.equal(plan.get("name"), "from-env");
  assert.equal(plan.get("storage"), "volume");
  assert.equal(plan.get("directory"), undefined);
  assert.equal(plan.get("demo"), false);
});

test("supplied values are validated before a plan is created", async () => {
  await assert.rejects(
    buildExecutionPlan(definition, {
      flags: {
        name: "invalid",
        storage: "volume",
        password: "private-value",
        demo: false,
      },
      options: { nonInteractive: true },
      terminal: terminal(false),
    }),
    { code: "WIZARD_VALIDATION_FAILED", message: "Nome inválido." },
  );
});

test("--yes skips only confirmation and execution receives the immutable plan", async () => {
  const plan = await buildExecutionPlan(definition, {
    flags: {
      name: "local",
      storage: "volume",
      password: "private-value",
      demo: false,
    },
    options: { nonInteractive: true },
    terminal: terminal(false),
  });
  let executed = false;
  const result = await executeExecutionPlan(
    plan,
    async (received) => {
      executed = true;
      assert.equal(received, plan);
      return received.get("name");
    },
    { options: { yes: true }, terminal: terminal(false) },
  );

  assert.equal(result, "local");
  assert.equal(executed, true);
});

test("confirmation cancellation is deterministic and does not execute", async () => {
  const plan = await buildExecutionPlan(definition, {
    flags: {
      name: "local",
      storage: "volume",
      password: "private-value",
      demo: false,
    },
    options: { nonInteractive: true },
    terminal: terminal(false),
  });
  const prompts = new ProgrammedPromptAdapter({ confirmation: false });
  let executed = false;

  await assert.rejects(
    executeExecutionPlan(
      plan,
      async () => {
        executed = true;
      },
      { promptAdapter: prompts, terminal: terminal() },
    ),
    { code: "PROMPT_CANCELLED", exitCode: 130 },
  );
  assert.equal(executed, false);
});

test("EOF/cancellation and interaction mode conflicts have stable errors", async () => {
  const prompts = new ProgrammedPromptAdapter({
    name: new PromptCancelledError(),
  });
  await assert.rejects(
    buildExecutionPlan(definition, {
      options: { interactive: true },
      promptAdapter: prompts,
      terminal: terminal(),
    }),
    { code: "PROMPT_CANCELLED", exitCode: 130 },
  );
  assert.throws(
    () =>
      normalizeWizardOptions(
        { interactive: true, nonInteractive: true },
        terminal(),
      ),
    { code: "INTERACTION_MODE_CONFLICT", exitCode: 2 },
  );
  assert.deepEqual(Object.keys(wizardFlags), [
    "defaults",
    "interactive",
    "json",
    "non-interactive",
    "yes",
  ]);
});

test("non-interactive confirmation requires --yes", async () => {
  const fakePlan = { kind: "test", values: {}, toJSON: () => ({}) };
  await assert.rejects(
    confirmExecutionPlan(fakePlan, {
      promptAdapter: new ProgrammedPromptAdapter({}, { isInteractive: false }),
      terminal: terminal(false),
    }),
    { code: "CONFIRMATION_REQUIRED", exitCode: 2 },
  );
});
