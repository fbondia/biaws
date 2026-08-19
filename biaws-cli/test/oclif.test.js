import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CLI_ENTRYPOINT = path.join(CLI_DIRECTORY, "bin", "biaws.js");

function run(...args) {
  return spawnSync(CLI_ENTRYPOINT, args, {
    cwd: CLI_DIRECTORY,
    encoding: "utf8",
    env: { ...process.env, BIAWS_API_KEY: "test-key" },
  });
}

test("a ajuda raiz expõe somente os três níveis canônicos", () => {
  const result = run("--help");
  assert.equal(result.status, 0);
  for (const topic of ["admin", "config", "workspace"])
    assert.match(result.stdout, new RegExp(`^  ${topic}\\s`, "mu"));
  assert.match(result.stdout, /^  help\s/mu);
  for (const legacy of ["instance", "configure", "skills", "monitoring"])
    assert.doesNotMatch(result.stdout, new RegExp(`^  ${legacy}\\s`, "mu"));
});

test("help explícito explica o produto, os níveis e o projeto", () => {
  const result = run("help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Bondia Workspaces \(BIAWS\)/u);
  assert.match(result.stdout, /NÍVEIS/u);
  assert.match(result.stdout, /biaws config init/u);
  assert.match(result.stdout, /https:\/\/github\.com\/fbondia\/biaws/u);
});

test("execução sem argumentos apresenta a introdução", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Bondia Workspaces \(BIAWS\)/u);
  assert.match(result.stdout, /PRIMEIROS PASSOS/u);
});

test("help explícito navega por tópicos aninhados", () => {
  const result = run("help", "workspace", "issues");
  assert.equal(result.status, 0, result.stderr);
  for (const action of ["list", "get", "transition"])
    assert.match(result.stdout, new RegExp(`workspace issues ${action}`));
});

test("os níveis organizam seus comandos", () => {
  const expectations = [
    [
      ["admin", "--help"],
      ["config", "doctor", "install", "instance", "monitoring"],
    ],
    [
      ["config", "--help"],
      ["init", "login", "show", "set", "unset", "doctor"],
    ],
    [
      ["workspace", "--help"],
      [
        "init",
        "use",
        "current",
        "unlink",
        "applications",
        "demands",
        "issues",
        "skills",
        "monitoring",
        "agent",
      ],
    ],
  ];
  for (const [args, commands] of expectations) {
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    for (const command of commands)
      assert.match(result.stdout, new RegExp(command));
  }
});

test("instâncias e perfis possuem ajuda contextual", () => {
  const instances = run("admin", "instance", "--help");
  assert.equal(instances.status, 0, instances.stderr);
  for (const action of ["setup", "list", "show", "status", "start", "stop"])
    assert.match(instances.stdout, new RegExp(`admin instance ${action}`));
  const profiles = run("config", "profiles", "--help");
  assert.equal(profiles.status, 0, profiles.stderr);
  assert.match(profiles.stdout, /config profiles list/u);
  assert.match(profiles.stdout, /config profiles use/u);
});

test("monitoramento administrativo expõe o ciclo operacional", () => {
  const result = run("admin", "monitoring", "--help");
  assert.equal(result.status, 0, result.stderr);
  for (const action of [
    "build",
    "validate",
    "start",
    "stop",
    "status",
    "logs",
    "provision",
  ])
    assert.match(result.stdout, new RegExp(`admin monitoring ${action}`));
});

test("as rotas antigas foram eliminadas", () => {
  for (const command of [
    ["instance", "list"],
    ["configure", "codex"],
    ["skills", "list"],
    ["workspaces", "list"],
    ["issues", "list"],
  ]) {
    const result = run(...command);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not found/u);
  }
});

test("comandos canônicos validam argumentos e flags pelo oclif", () => {
  const missing = run("workspace", "skills", "install");
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /Missing 1 required arg|SKILL/u);
  const invalid = run(
    "workspace",
    "monitoring",
    "signals",
    "runtime-1",
    "--bad-flag",
  );
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /Nonexistent flag: --bad-flag/u);
});

test("setup administrativo não aceita senha em argv", () => {
  const result = run("admin", "instance", "setup", "--help");
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /admin-password/u);
  assert.match(result.stdout, /BIAWS_BOOTSTRAP_ADMIN_PASSWORD/u);
});

test("admin install oferece plano versionado sem alteração", () => {
  const result = run("admin", "install", "--version", "1.2.3", "--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /releases\/download\/v1\.2\.3/u);
  assert.match(result.stdout, /biaws-1\.2\.3\.tar\.gz/u);
});

test("config init separa configuração e credencial", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-cli-config-"));
  try {
    const result = spawnSync(
      CLI_ENTRYPOINT,
      ["config", "init", "--api-url", "https://biaws.example.test"],
      {
        cwd: CLI_DIRECTORY,
        encoding: "utf8",
        env: {
          ...process.env,
          BIAWS_API_KEY: "private-key",
          BIAWS_CONFIG_HOME: root,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(await readFile(path.join(root, "config.json")));
    const credentials = JSON.parse(
      await readFile(path.join(root, "credentials.json")),
    );
    assert.equal(config.profiles.default.apiUrl, "https://biaws.example.test");
    assert.equal(credentials.profiles.default.apiKey, "private-key");
    assert.doesNotMatch(JSON.stringify(config), /private-key/u);
    assert.equal(
      (await stat(path.join(root, "credentials.json"))).mode & 0o777,
      0o600,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("workspace current encontra associação em pasta ancestral", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-cli-workspace-"));
  const nested = path.join(root, "src", "feature");
  try {
    await mkdir(path.join(root, ".biaws"), { recursive: true });
    await mkdir(nested, { recursive: true });
    await writeFile(
      path.join(root, ".biaws", "config.json"),
      JSON.stringify({ version: 1, profile: "default", workspaceId: "ws-a" }),
    );
    const result = spawnSync(CLI_ENTRYPOINT, ["workspace", "current"], {
      cwd: nested,
      encoding: "utf8",
      env: { ...process.env, BIAWS_CONFIG_HOME: path.join(root, "global") },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Workspace ws-a/u);
    assert.match(
      result.stdout,
      new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("comando remoto orienta a configurar credencial", () => {
  const result = spawnSync(CLI_ENTRYPOINT, ["workspace", "skills", "list"], {
    cwd: CLI_DIRECTORY,
    encoding: "utf8",
    env: {
      ...process.env,
      BIAWS_CONFIG_HOME: "/private/tmp/biaws-cli-test-no-auth",
      BIAWS_API_KEY: undefined,
      ISSUE_API_KEY: undefined,
    },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Chave de API ausente/u);
  assert.match(result.stderr, /biaws config login/u);
});
