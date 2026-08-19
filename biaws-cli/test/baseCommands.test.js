import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  AuthenticatedApiCommand,
  LocalInstanceCommand,
  ProjectCommand,
} from "../src/baseCommands.js";
import ConfigureClaude from "../src/commands/configure/claude.js";
import ConfigureCodex from "../src/commands/configure/codex.js";
import ConfigureDoctor from "../src/commands/configure/doctor.js";
import { interactiveConfigureInput } from "../src/configure/command.js";
import { ProgrammedPromptAdapter } from "../src/core/prompts.js";

function fakeConfig() {
  return { bin: "biaws" };
}

function adapters(environment = {}) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  return {
    environment,
    cwd: () => "/workspace/project",
    filesystem: {
      async readFile(filePath) {
        if (filePath === "/workspace/instances/local/.env") {
          return "BIAWS_API_URL=http://instance.test:3100\nBIAWS_API_KEY=private-key\nBIAWS_WORKSPACE_ID=workspace-a\n";
        }
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
    },
    terminal: {
      stdin: new PassThrough(),
      stdout,
      stderr,
      isCI: true,
      isInteractive: false,
    },
  };
}

test("LocalInstanceCommand resolve paths without requiring an API key", async () => {
  const environment = { BIAWS_ROOT: "/workspace" };
  const command = new LocalInstanceCommand(
    [],
    fakeConfig(),
    adapters(environment),
  );
  const context = await command.localContext({ instance: "empty" });

  assert.equal(context.repositoryRoot, "/workspace");
  assert.equal(context.instancesDirectory, "/workspace/instances");
  assert.equal(context.instanceDirectory, "/workspace/instances/empty");
  assert.equal(context.envFile, "/workspace/instances/empty/.env");
  assert.equal(context.apiKey, "");
  assert.deepEqual(environment, { BIAWS_ROOT: "/workspace" });
});

test("AuthenticatedApiCommand rejects missing credentials before creating API", async () => {
  let apiCreated = false;
  const command = new AuthenticatedApiCommand([], fakeConfig(), {
    ...adapters({ BIAWS_ROOT: "/workspace" }),
    apiFactory() {
      apiCreated = true;
      return {};
    },
  });

  await assert.rejects(command.authenticatedContext(), {
    code: "AUTHENTICATION_REQUIRED",
    exitCode: 2,
  });
  assert.equal(apiCreated, false);
});

test("ProjectCommand injects filesystem, API and terminal adapters", async () => {
  const fakeApi = { identity: async () => ({ actor: { id: "actor-a" } }) };
  const fakeProcessRunner = { run: async () => ({ processExitCode: 0 }) };
  const command = new ProjectCommand([], fakeConfig(), {
    ...adapters({
      BIAWS_ROOT: "/workspace",
      BIAWS_API_KEY: "private-key",
      BIAWS_WORKSPACE_ID: "workspace-a",
    }),
    apiFactory(apiUrl, apiKey, workspaceId) {
      assert.equal(apiUrl, "http://127.0.0.1:3100");
      assert.equal(apiKey, "private-key");
      assert.equal(workspaceId, "workspace-a");
      return fakeApi;
    },
    processRunner: fakeProcessRunner,
  });
  const context = await command.projectContext(
    { project: "/workspace/example" },
    { requireWorkspace: true },
  );

  assert.equal(context.projectDirectory, "/workspace/example");
  assert.equal(context.api, fakeApi);
  assert.equal(command.adapters.processRunner, fakeProcessRunner);
  assert.equal(context.isCI, true);
  assert.equal(context.isInteractive, false);
});

test("agent wrappers allow workspace discovery from the authenticated identity", async () => {
  for (const CommandClass of [
    ConfigureCodex,
    ConfigureClaude,
    ConfigureDoctor,
  ]) {
    const command = Object.create(CommandClass.prototype);
    command.adapters = { terminal: { isInteractive: false } };
    command.parse = async () => ({ args: { client: "codex" }, flags: {} });
    command.projectContext = async (_input, options) => {
      assert.equal(options, undefined);
      throw new Error("context inspected");
    };
    await assert.rejects(() => command.run(), /context inspected/u);
  }
});

test("agent assistant collects project and instance environment", async () => {
  const prompts = new ProgrammedPromptAdapter({
    project: "/workspace/selected",
    envFile: "/workspace/instances/local/.env",
  });
  const command = {
    adapters: {
      cwd: () => "/workspace/current",
      environment: {},
      prompts,
      terminal: { isInteractive: true },
    },
  };

  const input = await interactiveConfigureInput(command, {
    interactive: true,
  });

  assert.equal(input.project, "/workspace/selected");
  assert.equal(input.envFile, "/workspace/instances/local/.env");
  assert.deepEqual(prompts.questions, ["project", "envFile"]);
});

test("agent assistant is the default in an interactive terminal", async () => {
  const prompts = new ProgrammedPromptAdapter({
    project: "/workspace/selected",
    envFile: "/workspace/instances/local/.env",
  });
  const input = await interactiveConfigureInput(
    {
      adapters: {
        cwd: () => "/workspace/current",
        environment: {},
        prompts,
        terminal: { isInteractive: true },
      },
    },
    {},
  );

  assert.equal(input.interactive, true);
  assert.deepEqual(prompts.questions, ["project", "envFile"]);
});

test("--no-interactive disables the assistant in a terminal", async () => {
  const input = await interactiveConfigureInput(
    {
      adapters: {
        terminal: { isInteractive: true },
      },
    },
    { interactive: false, project: "/workspace/project" },
  );

  assert.equal(input.interactive, false);
  assert.equal(input.project, "/workspace/project");
});

test("agent assistant rejects non-interactive terminals", async () => {
  const command = {
    adapters: {
      cwd: () => "/workspace/current",
      environment: {},
      prompts: { isInteractive: false },
      terminal: { isInteractive: false },
    },
  };

  await assert.rejects(
    interactiveConfigureInput(command, { interactive: true }),
    { code: "INTERACTIVE_INPUT_UNAVAILABLE", exitCode: 2 },
  );
});
