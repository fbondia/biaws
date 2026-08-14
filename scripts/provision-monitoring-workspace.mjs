#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/u;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArguments(argv) {
  const result = { instance: "", workspace: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--instance") result.instance = argv[++index] || "";
    else if (option === "--workspace") result.workspace = argv[++index] || "";
    else if (option === "--help" || option === "-h") {
      console.log(
        "Uso: node scripts/provision-monitoring-workspace.mjs --instance <nome> --workspace <identificador>",
      );
      process.exit(0);
    } else fail(`Opção desconhecida: ${option}`);
  }
  if (!SAFE_NAME.test(result.instance) || !SAFE_NAME.test(result.workspace)) {
    fail(
      "Instância e workspace devem usar letras minúsculas, números e hífens.",
    );
  }
  return result;
}

function readEnv(file) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^(['"])(.*)\1$/u, "$2")]),
  );
}

function replaceEnvValues(file, values) {
  const pending = new Map(Object.entries(values));
  const lines = readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((line, index, all) => line || index < all.length - 1)
    .map((line) => {
      const match = line.match(/^([A-Z0-9_]+)=/u);
      if (!match || !pending.has(match[1])) return line;
      const value = pending.get(match[1]);
      pending.delete(match[1]);
      return `${match[1]}=${value}`;
    });
  for (const [key, value] of pending) lines.push(`${key}=${value}`);

  const temporaryPath = `${file}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${lines.join("\n")}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  renameSync(temporaryPath, file);
  chmodSync(file, 0o600);
}

const { instance, workspace } = parseArguments(process.argv.slice(2));
const instanceDir = path.join(ROOT_DIR, "instances", instance);
const instanceEnv = path.join(instanceDir, ".env");
const workspaceDir = path.join(
  instanceDir,
  "monitoring",
  "workspaces",
  workspace,
);
const workspaceEnv = path.join(workspaceDir, ".env");
if (!existsSync(instanceEnv)) fail(`Arquivo não encontrado: ${instanceEnv}`);
if (!existsSync(workspaceEnv)) fail(`Arquivo não encontrado: ${workspaceEnv}`);

const configuration = readEnv(workspaceEnv);
const workspaceId = configuration.BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID;
if (!workspaceId)
  fail("BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID não foi configurado.");

const secretsDir = path.join(workspaceDir, "secrets");
const apiKeyPath = path.join(secretsDir, "executor-api-key");
mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
const existingApiKey = existsSync(apiKeyPath)
  ? readFileSync(apiKeyPath, "utf8")
  : "";
const projectName = `biaws-${instance}`;
const email = `monitor-executor+${workspace}@localhost.invalid`;
const bootstrap = spawnSync(
  "docker",
  [
    "compose",
    "--file",
    path.join(ROOT_DIR, "compose.yaml"),
    "--env-file",
    instanceEnv,
    "--project-name",
    projectName,
    "exec",
    "-T",
    "-e",
    `BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_WORKSPACE_ID=${workspaceId}`,
    "-e",
    `BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_EMAIL=${email}`,
    "-e",
    `BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_NAME=BIAWS Monitor Executor (${workspace})`,
    "api",
    "sh",
    "-c",
    "IFS= read -r BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_API_KEY; export BIAWS_BOOTSTRAP_MONITOR_EXECUTOR_API_KEY; npm run --silent bootstrap:monitor-executor",
  ],
  {
    cwd: ROOT_DIR,
    encoding: "utf8",
    input: `${existingApiKey.replace(/\r?\n$/u, "")}\n`,
    maxBuffer: 1024 * 1024,
  },
);
if (bootstrap.status !== 0) {
  fail(bootstrap.stderr.trim() || "Falha ao provisionar a identidade técnica.");
}

const apiKey = bootstrap.stdout.match(
  /^BIAWS_MONITOR_EXECUTOR_API_KEY=(.+)$/mu,
)?.[1];
const returnedWorkspaceId = bootstrap.stdout.match(
  /^BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID=(.+)$/mu,
)?.[1];
if (!apiKey || returnedWorkspaceId !== workspaceId) {
  fail(
    "O bootstrap não retornou uma credencial válida para o workspace solicitado.",
  );
}

const temporaryPath = path.join(
  secretsDir,
  `.executor-api-key.${process.pid}.tmp`,
);
writeFileSync(temporaryPath, apiKey, { mode: 0o600, flag: "wx" });
renameSync(temporaryPath, apiKeyPath);
chmodSync(apiKeyPath, 0o600);
replaceEnvValues(workspaceEnv, {
  BIAWS_MONITOR_EXECUTOR_UID: process.getuid?.() ?? 1000,
  BIAWS_MONITOR_EXECUTOR_GID: process.getgid?.() ?? 1000,
});
console.log(`Identidade técnica do executor provisionada para ${workspace}.`);
