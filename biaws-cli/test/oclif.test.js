import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function run(...args) {
  return spawnSync(process.execPath, ["src/index.js", ...args], {
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
  ]) {
    assert.match(result.stdout, new RegExp(command));
  }
});

test("oclif gera ajuda contextual para um domínio", () => {
  const result = run("instance", "--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Instala, configura e opera instâncias locais/);
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
  const result = spawnSync(
    process.execPath,
    ["src/index.js", "skills", "list"],
    {
      cwd: CLI_DIRECTORY,
      encoding: "utf8",
      env: {
        ...process.env,
        BIAWS_ROOT: "/private/tmp/biaws-cli-test-no-auth",
        ISSUE_API_KEY: undefined,
      },
    },
  );
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Chave da API ausente/u);
});
