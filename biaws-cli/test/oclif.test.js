import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
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
    env: { ...process.env, ISSUE_API_KEY: "test-key" },
  });
}

test("oclif gera a ajuda raiz com taxonomia e rotas legadas", () => {
  const result = run("--help");
  assert.equal(result.status, 0);
  for (const command of [
    "instance",
    "configure",
    "api",
    "skills",
    "monitoring",
    "workspaces",
    "applications",
    "demands",
    "issues",
  ]) {
    assert.match(result.stdout, new RegExp(command));
  }
});

test("recursos remotos expõem list/get e tarefas com help contextual", () => {
  const expectations = [
    ["workspaces", ["list", "get"]],
    ["applications", ["list", "get"]],
    ["demands", ["list", "get", "tasks", "task-status", "complete-task"]],
    ["issues", ["list", "get", "transition"]],
  ];
  for (const [topic, commands] of expectations) {
    const result = run(topic, "--help");
    assert.equal(result.status, 0, result.stderr);
    for (const command of commands)
      assert.match(result.stdout, new RegExp(`${topic} ${command}`));
  }
});

test("oclif gera ajuda contextual para um domínio", () => {
  const result = run("instance", "--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Instala, configura e opera instâncias locais/);
  for (const command of ["setup", "list", "show", "status", "start", "stop"]) {
    assert.match(result.stdout, new RegExp(`instance ${command}`));
  }
});

test("configure expõe clientes, skills e doctor como comandos oclif", () => {
  const result = run("configure", "--help");
  assert.equal(result.status, 0, result.stderr);
  for (const command of ["codex", "claude", "skills", "doctor"]) {
    assert.match(result.stdout, new RegExp(`configure ${command}`));
  }
});

test("rotas compatíveis de skills, agent e monitoring são subcomandos oclif", () => {
  const expectations = [
    [
      "skills",
      [
        "list",
        "install",
        "install-all",
        "status",
        "update",
        "publish",
        "publish-all",
      ],
    ],
    ["agent", ["configure", "doctor"]],
    ["monitoring", ["signal", "signals", "describe", "validate"]],
  ];
  for (const [topic, commands] of expectations) {
    const result = run(topic, "--help");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    for (const command of commands) {
      assert.match(result.stdout, new RegExp(`${topic} ${command}`));
    }
  }
});

test("rotas migradas validam argumentos e flags pelo oclif", () => {
  const missingArgument = run("skills", "install");
  assert.equal(missingArgument.status, 2);
  assert.match(missingArgument.stderr, /Missing 1 required arg|SKILL/u);

  const invalidFlag = run("monitoring", "signals", "runtime-1", "--bad-flag");
  assert.equal(invalidFlag.status, 2);
  assert.match(invalidFlag.stderr, /Nonexistent flag: --bad-flag/u);
});

test("configure doctor sem cliente falha de forma explícita fora de TTY", () => {
  const result = run("configure", "doctor", "--non-interactive");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Campos obrigatórios ausentes: client/u);
});

test("configure skills exige seleção explícita fora de TTY", () => {
  const result = run("configure", "skills", "install");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Informe o ID da skill ou use --all/u);
});

test("setup não aceita password em argv e documenta o ambiente privado", () => {
  const result = run("instance", "setup", "--help");
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /admin-password/u);
  assert.match(result.stdout, /BIAWS_BOOTSTRAP_ADMIN_PASSWORD/u);
});

test("comando desconhecido retorna diagnóstico e código de uso", () => {
  const result = run("inexistente");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /inexistente/);
});

test("flag inválida retorna diagnóstico e código de uso", () => {
  const result = run("instance", "--bad-flag");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Nonexistent flag|bad-flag/);
});

test("versão vem dos metadados do pacote", () => {
  const result = run("--version");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /0\.1\.0/);
});

test("comando remoto valida autenticação antes da operação", () => {
  const result = spawnSync(CLI_ENTRYPOINT, ["skills", "list"], {
    cwd: CLI_DIRECTORY,
    encoding: "utf8",
    env: {
      ...process.env,
      BIAWS_ROOT: "/private/tmp/biaws-cli-test-no-auth",
      ISSUE_API_KEY: undefined,
    },
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Chave da API ausente/u);
});
