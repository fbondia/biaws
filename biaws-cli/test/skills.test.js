import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checksumInstalledSkill,
  installSkillPackage,
  readLock,
} from "../src/localSkills.js";
import { runSkillsCommand } from "../src/commands/skills.js";
import {
  buildSkillPayload,
  checksumPackageFiles,
} from "../src/skillPackage.js";
import { createApiClient } from "../src/apiClient.js";
import { MCP_PACKAGE_SPEC, runAgentCommand } from "../src/commands/agent.js";
import { runMonitoringCommand } from "../src/commands/monitoring.js";
import { loadEnv } from "../../shared/index.js";

test("explicit instance env overrides repository defaults", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-env-"));
  const tool = path.join(root, "biaws-cli");
  const instanceEnv = path.join(root, "instances", "client-a", ".env");
  await mkdir(tool, { recursive: true });
  await mkdir(path.dirname(instanceEnv), { recursive: true });
  await writeFile(path.join(root, ".env"), "BIAWS_API_URL=http://root:3100\n");
  await writeFile(instanceEnv, "BIAWS_API_URL=http://client-a:3101\n");
  const previousUrl = process.env.BIAWS_API_URL;
  const previousEnvFile = process.env.BIAWS_ENV_FILE;
  delete process.env.BIAWS_API_URL;
  process.env.BIAWS_ENV_FILE = instanceEnv;

  try {
    const result = loadEnv(tool);
    assert.equal(process.env.BIAWS_API_URL, "http://client-a:3101");
    assert.equal(result.loaded.at(-1), instanceEnv);
  } finally {
    if (previousUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = previousUrl;
    if (previousEnvFile === undefined) delete process.env.BIAWS_ENV_FILE;
    else process.env.BIAWS_ENV_FILE = previousEnvFile;
  }
});

test("preserved project environment overrides the instance workspace", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-env-workspace-"));
  const tool = path.join(root, "biaws-mcp");
  const instanceEnv = path.join(root, "instances", "client-a", ".env");
  await mkdir(tool, { recursive: true });
  await mkdir(path.dirname(instanceEnv), { recursive: true });
  await writeFile(instanceEnv, "BIAWS_WORKSPACE_ID=workspace-antigo\n");
  const previousWorkspace = process.env.BIAWS_WORKSPACE_ID;
  process.env.BIAWS_WORKSPACE_ID = "workspace-do-projeto";

  try {
    loadEnv(tool, {
      envPath: instanceEnv,
      preserve: ["BIAWS_WORKSPACE_ID"],
    });
    assert.equal(process.env.BIAWS_WORKSPACE_ID, "workspace-do-projeto");
  } finally {
    if (previousWorkspace === undefined) delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = previousWorkspace;
  }
});

test("API client sends the configured Bearer key", async () => {
  const originalFetch = globalThis.fetch;
  let receivedAuthorization;
  let receivedWorkspace;
  globalThis.fetch = async (_url, options) => {
    receivedAuthorization = options.headers.Authorization;
    receivedWorkspace = options.headers["X-Biaws-Workspace-Id"];
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await createApiClient(
      "http://127.0.0.1:3100",
      "biaws_secret",
      "workspace-a",
    ).list();
    assert.equal(receivedAuthorization, "Bearer biaws_secret");
    assert.equal(receivedWorkspace, "workspace-a");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API client distinguishes forbidden responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ error: { code: "FORBIDDEN", message: "Denied" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  try {
    await assert.rejects(
      () => createApiClient("http://127.0.0.1:3100", "biaws_secret").list(),
      (error) => error.code === "FORBIDDEN" && error.statusCode === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("monitoring command sends an idempotent runtime health signal", async () => {
  let received;
  const api = {
    monitoring: {
      signal: async (runtimeId, payload) => {
        received = { runtimeId, payload };
        return {
          created: true,
          signal: { runtimeId, ...payload },
        };
      },
    },
  };
  await runMonitoringCommand(api, "signal", ["billing.api.prod.primary"], {
    status: "healthy",
    source: "synthetic-check",
    "signal-id": "check:42",
    "observed-at": "2026-07-31T15:00:00.000Z",
    message: "HTTP 200",
    "metadata-profile": "sgmp-health/v1",
    metadata: '{"service_up":true,"database_up":true,"disk_usage_percent":35}',
    payload: '{"probe":{"status":200}}',
    json: true,
  });
  assert.deepEqual(received, {
    runtimeId: "billing.api.prod.primary",
    payload: {
      status: "healthy",
      source: "synthetic-check",
      signalId: "check:42",
      observedAt: "2026-07-31T15:00:00.000Z",
      message: "HTTP 200",
      metadataProfile: "sgmp-health/v1",
      metadata: {
        service_up: true,
        database_up: true,
        disk_usage_percent: 35,
      },
      payload: { probe: { status: 200 } },
    },
  });
});

test("builds a publish payload from a skill directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-cli-build-"));
  await mkdir(path.join(root, "references"));
  await writeFile(
    path.join(root, "SKILL.md"),
    "---\nname: biaws-example\ndescription: Example skill\n---\n",
  );
  await writeFile(path.join(root, "references", "guide.md"), "Guide");

  const payload = await buildSkillPayload(root, { version: "1.0.0" });

  assert.equal(payload.skillId, "biaws-example");
  assert.equal(payload.description, "Example skill");
  assert.deepEqual(
    payload.files.map((file) => file.path),
    ["references/guide.md", "SKILL.md"],
  );
});

test("installs a package and records the local lock", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "biaws-cli-install-"));
  const target = path.join(workspace, ".agents", "skills");
  const files = [
    {
      path: "SKILL.md",
      contentBase64: Buffer.from("# Example\n").toString("base64"),
    },
  ];
  const packageSha256 = checksumPackageFiles(files);
  const result = await installSkillPackage(
    {
      format: "biaws-skill-package/v1",
      skill: {
        skillId: "biaws-example",
        version: "1.0.0",
        packageSha256,
        files,
      },
    },
    target,
  );

  assert.equal(
    await readFile(path.join(result.directory, "SKILL.md"), "utf8"),
    "# Example\n",
  );
  const lock = await readLock(target);
  assert.equal(lock.skills["biaws-example"].version, "1.0.0");
  assert.equal(lock.skills["biaws-example"].packageSha256, packageSha256);
  assert.equal(await checksumInstalledSkill(result.directory), packageSha256);
});

test("publish-all publishes skill directories and skips existing versions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-cli-publish-all-"));
  for (const skillId of ["biaws-existing", "biaws-new"]) {
    const directory = path.join(root, skillId);
    await mkdir(directory);
    await writeFile(
      path.join(directory, "SKILL.md"),
      `---\nname: ${skillId}\ndescription: ${skillId} description\n---\n`,
    );
  }
  await mkdir(path.join(root, "not-a-skill"));

  const published = [];
  const api = {
    list: async () => ({
      items: [
        {
          skillId: "biaws-existing",
          versions: [{ version: "1.0.0" }],
        },
      ],
    }),
    publish: async (payload) => {
      published.push(payload.skillId);
      return {
        skill: {
          ...payload,
          packageSha256: "checksum",
        },
      };
    },
  };

  await runSkillsCommand(api, "publish-all", [], {
    dir: root,
    "initial-version": "1.0.0",
    json: true,
  });

  assert.deepEqual(published, ["biaws-new"]);
});

test("agent configure writes Codex MCP config and installs catalog skills", async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), "biaws-agent-config-"));
  const files = [
    {
      path: "SKILL.md",
      contentBase64: Buffer.from(
        "---\nname: biaws-example\ndescription: Example\n---\n",
      ).toString("base64"),
    },
  ];
  const packageSha256 = checksumPackageFiles(files);
  const api = {
    identity: async () => ({ actor: { workspaceId: "workspace-a" } }),
    list: async () => ({
      items: [
        {
          skillId: "biaws-example",
          latestVersion: "1.0.0",
          description: "Example",
        },
      ],
    }),
    get: async () => ({
      skill: { skillId: "biaws-example", version: "1.0.0" },
    }),
    download: async () => ({
      format: "biaws-skill-package/v1",
      skill: {
        skillId: "biaws-example",
        version: "1.0.0",
        packageSha256,
        files,
      },
    }),
  };

  const result = await runAgentCommand(
    api,
    "configure",
    ["codex"],
    { project },
    {
      toolDirectory: path.resolve("."),
      apiUrl: "http://127.0.0.1:3100",
      apiKey: "biaws_test",
      workspaceId: "workspace-a",
      envFile: "/tmp/client-a.env",
    },
  );

  const config = await readFile(
    path.join(project, ".codex", "config.toml"),
    "utf8",
  );
  assert.match(config, /\[mcp_servers\.biaws\]/u);
  assert.match(config, /command = "npx"/u);
  assert.ok(config.includes(JSON.stringify(MCP_PACKAGE_SPEC)));
  assert.match(config, /BIAWS_ENV_FILE = "\/tmp\/client-a\.env"/u);
  assert.match(config, /BIAWS_WORKSPACE_ID = "workspace-a"/u);
  assert.equal(
    await readFile(
      path.join(project, ".agents", "skills", "biaws-example", "SKILL.md"),
      "utf8",
    ),
    "---\nname: biaws-example\ndescription: Example\n---\n",
  );
  assert.equal(result.installation.installed.length, 1);
});

test("agent configure merges Claude MCP config without removing other servers", async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), "biaws-claude-config-"));
  await writeFile(
    path.join(project, ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        existing: { command: "existing", args: [] },
        biaws: {
          type: "stdio",
          command: "node",
          args: ["/checkout/biaws/biaws-mcp/src/index.js"],
        },
      },
    }),
  );
  const api = {
    identity: async () => ({ actor: { workspaceId: "workspace-b" } }),
    list: async () => ({ items: [] }),
  };

  await runAgentCommand(
    api,
    "configure",
    ["claude"],
    { project },
    {
      toolDirectory: path.resolve("."),
      apiUrl: "http://127.0.0.1:3100",
      apiKey: "biaws_test",
      workspaceId: "",
      envFile: "/tmp/client-b.env",
    },
  );

  const config = JSON.parse(
    await readFile(path.join(project, ".mcp.json"), "utf8"),
  );
  assert.equal(config.mcpServers.existing.command, "existing");
  assert.equal(config.mcpServers.biaws.command, "npx");
  assert.deepEqual(config.mcpServers.biaws.args, ["--yes", MCP_PACKAGE_SPEC]);
  assert.equal(config.mcpServers.biaws.env.BIAWS_ENV_FILE, "/tmp/client-b.env");
  assert.equal(config.mcpServers.biaws.env.BIAWS_WORKSPACE_ID, "workspace-b");
});

test("agent configure requires a project workspace for multi-workspace identities", async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), "biaws-agent-scope-"));
  const api = {
    identity: async () => ({
      actor: {
        workspaceId: null,
        workspaces: [{ id: "workspace-a" }, { id: "workspace-b" }],
      },
    }),
  };

  await assert.rejects(
    () =>
      runAgentCommand(
        api,
        "configure",
        ["codex"],
        { project },
        {
          toolDirectory: path.resolve("."),
          apiUrl: "http://127.0.0.1:3100",
          apiKey: "biaws_test",
          workspaceId: "",
          envFile: "/tmp/client.env",
        },
      ),
    /Informe --workspace <id>/u,
  );
});

test("agent configure assistant selects the project workspace", async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), "biaws-agent-wizard-"));
  const api = {
    identity: async () => ({
      actor: {
        workspaceId: null,
        workspaces: [
          { id: "workspace-a", name: "Equipe A" },
          { id: "workspace-b", name: "Equipe B" },
        ],
      },
    }),
    list: async () => ({ items: [] }),
  };
  const prompts = {
    ask: async (question) => {
      if (question.name === "workspaceId") {
        assert.deepEqual(
          question.choices.map((choice) => choice.value),
          ["workspace-a", "workspace-b"],
        );
        return "workspace-b";
      }
      assert.equal(question.name, "confirmConfiguration");
      assert.match(question.message, /workspace-b/u);
      return true;
    },
  };

  await runAgentCommand(
    api,
    "configure",
    ["codex"],
    { project, interactive: true, prompts },
    {
      toolDirectory: path.resolve("."),
      apiUrl: "http://127.0.0.1:3100",
      apiKey: "biaws_test",
      workspaceId: "",
      envFile: "/tmp/client.env",
    },
  );

  const config = await readFile(
    path.join(project, ".codex", "config.toml"),
    "utf8",
  );
  assert.match(config, /BIAWS_WORKSPACE_ID = "workspace-b"/u);
});

test("agent doctor performs a real MCP handshake", async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), "biaws-agent-doctor-"));
  const executableDirectory = await mkdtemp(
    path.join(os.tmpdir(), "biaws-agent-bin-"),
  );
  const entrypoint = path.resolve("..", "biaws-mcp", "src", "index.js");
  const npx = path.join(executableDirectory, "npx");
  await writeFile(
    npx,
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(entrypoint)}\n`,
  );
  await chmod(npx, 0o755);
  await mkdir(path.join(project, ".codex"), { recursive: true });
  await mkdir(path.join(project, ".agents"), { recursive: true });
  await writeFile(
    path.join(project, ".codex", "config.toml"),
    `[mcp_servers.biaws]\ncommand = "npx"\nargs = ${JSON.stringify(["--yes", MCP_PACKAGE_SPEC])}\nenv = { BIAWS_WORKSPACE_ID = "workspace-a" }\n`,
  );
  await writeFile(
    path.join(project, ".agents", "biaws-skills.lock.json"),
    JSON.stringify({
      format: "biaws-skills-lock/v1",
      skills: {
        "biaws-example": {
          version: "1.0.0",
          packageSha256: "checksum",
        },
      },
    }),
  );
  const originalFetch = globalThis.fetch;
  const originalPath = process.env.PATH;
  process.env.PATH = `${executableDirectory}${path.delimiter}${originalPath}`;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: "ok", actor: { id: "agent-1" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const result = await runAgentCommand(
      { identity: async () => ({ actor: { workspaceId: "workspace-a" } }) },
      "doctor",
      ["codex"],
      { project, json: true },
      {
        toolDirectory: path.resolve("."),
        apiUrl: "http://127.0.0.1:3100",
        apiKey: "biaws_test",
        workspaceId: "",
        envFile: "",
      },
    );
    assert.equal(result.ok, true);
    assert.ok(result.checks.mcp.toolCount > 0);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.PATH = originalPath;
    process.exitCode = 0;
  }
});
