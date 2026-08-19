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
          return "ISSUE_API_URL=http://instance.test:3100\nISSUE_API_KEY=private-key\nISSUE_WORKSPACE_ID=workspace-a\n";
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
      ISSUE_API_KEY: "private-key",
      ISSUE_WORKSPACE_ID: "workspace-a",
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
    command.parse = async () => ({ args: { client: "codex" }, flags: {} });
    command.projectContext = async (_input, options) => {
      assert.equal(options, undefined);
      throw new Error("context inspected");
    };
    await assert.rejects(() => command.run(), /context inspected/u);
  }
});
