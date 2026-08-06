#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "../../shared/index.js";
import { createApiClient } from "./apiClient.js";
import { parseArgs } from "./args.js";
import { runAgentCommand } from "./commands/agent.js";
import { runSkillsCommand } from "./commands/skills.js";
import { runMonitoringCommand } from "./commands/monitoring.js";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function printUsage() {
  console.log(`
Uso:
  biaws skills list [--json]
  biaws skills publish --dir <diretório> --version <semver> [opções]
  biaws skills publish-all [--dir <diretório>] --initial-version <semver>
  biaws skills install <skill-id> [--version <semver>] [--target <diretório>]
  biaws skills install-all [--target <diretório>]
  biaws skills status [--target <diretório>]
  biaws skills update [skill-id] [--target <diretório>]
  biaws agent configure codex|claude [--project <diretório>]
  biaws agent doctor codex|claude [--project <diretório>]
  biaws monitoring signal <runtime> --status <estado> --source <origem> [opções]
  biaws monitoring signals <runtime> [--limit <n>] [--json]

Opções:
  --api-url <url>       URL da biaws-api; default: ISSUE_API_URL ou http://127.0.0.1:3100
  --api-key <chave>     Chave da API; prefira a variável ISSUE_API_KEY
  --workspace <id>      Workspace do projeto; obrigatório se a chave acessar vários
  --target <diretório>  Diretório de instalação; default: .agents/skills
  --project <diretório> Projeto no qual configurar o cliente; default: diretório atual
  --version <semver>    Versão a publicar ou instalar
  --initial-version <v> Versão usada por skills publish-all
  --dir <diretório>     Diretório-fonte usado na publicação
  --name <nome>         Nome de exibição opcional
  --description <texto> Descrição opcional; por padrão usa o frontmatter do SKILL.md
  --status <estado>     unknown, healthy, degraded, unavailable ou stopped
  --source <origem>     Identificação do agente ou sistema de monitoramento
  --signal-id <id>      ID idempotente do aviso na origem
  --observed-at <data>  Data ISO-8601 da observação; default: agora
  --message <texto>     Resumo legível do sinal
  --metadata-profile <id> Perfil versionado dos metadados, como sgmp-health/v1
  --metadata <json>     Metadados escalares, sem segredos
  --payload <json>      Payload JSON aninhado, limitado e sem segredos
  <runtime>             UUID ou caminho aplicação.componente.deployment.runtime
  --changelog <texto>   Alterações da versão
  --force               Substitui uma instalação existente, preservando backup
  --json                Produz saída JSON
  --help                Exibe esta ajuda
`);
}

async function main() {
  loadEnv(TOOL_DIR);
  const [, , domain, action, ...rawArgs] = process.argv;
  if (
    !domain ||
    domain === "help" ||
    domain === "--help" ||
    rawArgs.includes("--help")
  ) {
    printUsage();
    return;
  }
  if (!["skills", "agent", "monitoring"].includes(domain))
    throw new Error(`Domínio desconhecido: ${domain}`);
  const { positional, options } = parseArgs(rawArgs);
  const apiUrl =
    options["api-url"] ||
    process.env.ISSUE_API_URL ||
    process.env.ISSUE_API_BASE_URL ||
    "http://127.0.0.1:3100";
  const apiKey = options["api-key"] || process.env.ISSUE_API_KEY;
  const workspaceId = options.workspace || process.env.ISSUE_WORKSPACE_ID || "";
  if (!apiKey) {
    throw new Error(
      "Chave da API ausente. Defina ISSUE_API_KEY ou informe --api-key.",
    );
  }
  const api = createApiClient(apiUrl, apiKey, workspaceId);
  if (domain === "skills") {
    await runSkillsCommand(api, action, positional, options);
    return;
  }
  if (domain === "monitoring") {
    await runMonitoringCommand(api, action, positional, options);
    return;
  }
  await runAgentCommand(api, action, positional, options, {
    apiUrl: apiUrl.replace(/\/+$/u, ""),
    apiKey,
    workspaceId,
    toolDirectory: TOOL_DIR,
    envFile: process.env.BIAWS_ENV_FILE
      ? path.resolve(process.env.BIAWS_ENV_FILE)
      : "",
  });
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
});
