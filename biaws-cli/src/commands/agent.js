import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { readLock } from "../localSkills.js";
import { runSkillsCommand } from "./skills.js";

const CODEX_BEGIN = "# BEGIN BIAWS MANAGED MCP";
const CODEX_END = "# END BIAWS MANAGED MCP";

function skillTarget(client, projectDirectory) {
  return path.join(
    projectDirectory,
    client === "claude" ? ".claude" : ".agents",
    "skills",
  );
}

function mcpEntrypoint(toolDirectory) {
  return path.resolve(toolDirectory, "..", "biaws-mcp", "src", "index.js");
}

async function readOptional(filePath, fallback = "") {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeCodexConfiguration(
  projectDirectory,
  entrypoint,
  envFile,
  workspaceId,
  force,
) {
  const configPath = path.join(projectDirectory, ".codex", "config.toml");
  await mkdir(path.dirname(configPath), { recursive: true });
  let current = await readOptional(configPath);
  const managedPattern = new RegExp(
    `${CODEX_BEGIN.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}[\\s\\S]*?${CODEX_END.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\n?`,
    "gu",
  );
  current = current.replace(managedPattern, "").trimEnd();
  if (/\[mcp_servers\.biaws\]/u.test(current) && !force) {
    throw new Error(
      `Já existe uma configuração Codex não gerenciada para mcp_servers.biaws em ${configPath}; use --force para mantê-la sob gestão do CLI`,
    );
  }
  if (force) {
    current = current.replace(
      /\n?\[mcp_servers\.biaws\]\n(?:[^[\n].*\n?)*/gu,
      "",
    );
  }
  const managed = `${CODEX_BEGIN}
[mcp_servers.biaws]
command = "node"
args = [${JSON.stringify(entrypoint)}]
env = {${envFile ? ` BIAWS_ENV_FILE = ${JSON.stringify(envFile)},` : ""} ISSUE_WORKSPACE_ID = ${JSON.stringify(workspaceId)} }
${CODEX_END}
`;
  const output = current ? `${current}\n\n${managed}` : managed;
  await writeFile(configPath, output, "utf8");
  return configPath;
}

async function writeClaudeConfiguration(
  projectDirectory,
  entrypoint,
  envFile,
  workspaceId,
  force,
) {
  const configPath = path.join(projectDirectory, ".mcp.json");
  const raw = await readOptional(configPath, "{}");
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`JSON inválido em ${configPath}`);
  }
  config.mcpServers ||= {};
  if (config.mcpServers.biaws && !force) {
    const current = config.mcpServers.biaws;
    if (
      current.command !== "node" ||
      JSON.stringify(current.args || []) !== JSON.stringify([entrypoint])
    ) {
      throw new Error(
        `Já existe uma configuração Claude diferente para o servidor biaws em ${configPath}; use --force para substituí-la`,
      );
    }
  }
  config.mcpServers.biaws = {
    type: "stdio",
    command: "node",
    args: [entrypoint],
    env: {
      ...(envFile ? { BIAWS_ENV_FILE: envFile } : {}),
      ISSUE_WORKSPACE_ID: workspaceId,
    },
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return configPath;
}

async function resolveWorkspaceId(api, requestedWorkspaceId = "") {
  let identity;
  try {
    identity = await api.identity();
  } catch (error) {
    if (!requestedWorkspaceId && error.statusCode === 400) {
      throw new Error(
        "A identidade acessa mais de um workspace. Informe --workspace <id> para selecionar o workspace deste projeto.",
      );
    }
    throw error;
  }
  const workspaceId = requestedWorkspaceId || identity?.actor?.workspaceId;
  if (!workspaceId) {
    if ((identity?.actor?.workspaces?.length || 0) > 1) {
      throw new Error(
        "A identidade acessa mais de um workspace. Informe --workspace <id> para selecionar o workspace deste projeto.",
      );
    }
    throw new Error(
      "Não foi possível determinar o workspace. Informe --workspace <id> e confirme que a identidade técnica é membro dele.",
    );
  }
  return { workspaceId, identity };
}

async function configure(api, client, options, context) {
  if (!["codex", "claude"].includes(client)) {
    throw new Error("Informe o cliente: biaws agent configure codex|claude");
  }
  const projectDirectory = path.resolve(options.project || process.cwd());
  const { workspaceId } = await resolveWorkspaceId(api, context.workspaceId);
  const target = skillTarget(client, projectDirectory);
  const entrypoint = mcpEntrypoint(context.toolDirectory);
  const configPath =
    client === "codex"
      ? await writeCodexConfiguration(
          projectDirectory,
          entrypoint,
          context.envFile,
          workspaceId,
          options.force,
        )
      : await writeClaudeConfiguration(
          projectDirectory,
          entrypoint,
          context.envFile,
          workspaceId,
          options.force,
        );
  const installation = await runSkillsCommand(api, "install-all", [], {
    target,
    force: options.force,
    json: false,
    quiet: true,
  });
  const result = {
    client,
    projectDirectory,
    configPath,
    skillTarget: target,
    installation,
    workspaceId,
  };
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Cliente ${client} configurado em ${configPath}`);
    console.log(`Skills disponíveis em ${target}`);
  }
  return result;
}

async function requestStatus(url, headers = {}) {
  try {
    const response = await fetch(url, { headers });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      detail: response.ok ? null : body?.error?.message || null,
    };
  } catch (error) {
    return { ok: false, status: null, detail: error.message };
  }
}

async function mcpStatus(entrypoint, envFile, workspaceId) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(envFile ? { BIAWS_ENV_FILE: envFile } : {}),
        ISSUE_WORKSPACE_ID: workspaceId,
      },
    });
    let output = "";
    let errorOutput = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      resolve(result);
    };
    const timeout = setTimeout(
      () =>
        finish({
          ok: false,
          detail: errorOutput.trim() || "MCP não respondeu em 5 segundos",
        }),
      5_000,
    );
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk;
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const lines = output.split(/\r?\n/u);
      output = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message.id === 2 && Array.isArray(message.result?.tools)) {
            finish({ ok: true, toolCount: message.result.tools.length });
          }
        } catch {
          finish({ ok: false, detail: "MCP retornou uma resposta inválida" });
        }
      }
    });
    child.on("error", (error) => finish({ ok: false, detail: error.message }));
    child.on("exit", (code) => {
      if (!settled && code !== null) {
        finish({
          ok: false,
          detail: errorOutput.trim() || `MCP encerrou com código ${code}`,
        });
      }
    });
    child.stdin.end(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {} },
      })}\n${JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      })}\n`,
    );
  });
}

function configurationStatus(
  client,
  contents,
  entrypoint,
  envFile,
  workspaceId,
) {
  if (typeof contents !== "string") {
    return { ok: false, detail: "Configuração MCP não encontrada" };
  }
  if (client === "codex") {
    const ok =
      contents.includes("[mcp_servers.biaws]") &&
      contents.includes(JSON.stringify(entrypoint)) &&
      (!envFile || contents.includes(JSON.stringify(envFile))) &&
      contents.includes(`ISSUE_WORKSPACE_ID = ${JSON.stringify(workspaceId)}`);
    return {
      ok,
      detail: ok
        ? null
        : "A configuração Codex não aponta para a instância selecionada",
    };
  }
  try {
    const server = JSON.parse(contents).mcpServers?.biaws;
    const ok =
      server?.command === "node" &&
      JSON.stringify(server.args || []) === JSON.stringify([entrypoint]) &&
      (!envFile || server.env?.BIAWS_ENV_FILE === envFile) &&
      server.env?.ISSUE_WORKSPACE_ID === workspaceId;
    return {
      ok,
      detail: ok
        ? null
        : "A configuração Claude não aponta para a instância selecionada",
    };
  } catch {
    return { ok: false, detail: "Configuração Claude contém JSON inválido" };
  }
}

async function doctor(api, client, options, context) {
  if (!["codex", "claude"].includes(client)) {
    throw new Error("Informe o cliente: biaws agent doctor codex|claude");
  }
  const projectDirectory = path.resolve(options.project || process.cwd());
  const target = skillTarget(client, projectDirectory);
  const configPath =
    client === "codex"
      ? path.join(projectDirectory, ".codex", "config.toml")
      : path.join(projectDirectory, ".mcp.json");
  const entrypoint = mcpEntrypoint(context.toolDirectory);
  const resolved = await resolveWorkspaceId(api, context.workspaceId);
  const [health, mcp, configContents, lock] = await Promise.all([
    requestStatus(`${context.apiUrl}/api/health`),
    mcpStatus(entrypoint, context.envFile, resolved.workspaceId),
    readOptional(configPath, null),
    readLock(target),
  ]);
  const checks = {
    node: { ok: Number(process.versions.node.split(".")[0]) >= 20 },
    api: health,
    authentication: { ok: true },
    workspace: { ok: true, id: resolved.workspaceId },
    mcp,
    configuration: {
      ...configurationStatus(
        client,
        configContents,
        entrypoint,
        context.envFile,
        resolved.workspaceId,
      ),
      path: configPath,
    },
    skills: {
      ok: Object.keys(lock.skills).length > 0,
      count: Object.keys(lock.skills).length,
      target,
    },
  };
  const ok = Object.values(checks).every((check) => check.ok);
  const result = { ok, client, checks };
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const [name, check] of Object.entries(checks)) {
      console.log(`${check.ok ? "OK" : "FALHA"}  ${name}`);
      if (!check.ok && check.detail) console.log(`       ${check.detail}`);
    }
  }
  if (!ok) process.exitCode = 1;
  return result;
}

export async function runAgentCommand(
  api,
  action,
  positional,
  options,
  context,
) {
  const client = positional[0];
  if (action === "configure") return configure(api, client, options, context);
  if (action === "doctor") return doctor(api, client, options, context);
  throw new Error(`Ação de agente desconhecida: ${action || "(ausente)"}`);
}
