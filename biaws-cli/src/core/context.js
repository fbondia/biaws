import path from "node:path";

import { CliError } from "./errors.js";

const DEFAULT_API_URL = "http://127.0.0.1:3100";

export function parseEnv(contents) {
  const parsed = {};
  for (const rawLine of String(contents || "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value.replace(/\\n/gu, "\n");
  }
  return parsed;
}

async function readEnvFile(filesystem, filePath) {
  if (!filePath) return {};
  try {
    return parseEnv(await filesystem.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new CliError(`Não foi possível ler a configuração em ${filePath}.`, {
      code: "ENV_FILE_READ_FAILED",
      cause: error,
    });
  }
}

function normalizeApiUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw new CliError("A URL da API é inválida.", {
      code: "INVALID_API_URL",
      exitCode: 2,
    });
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new CliError(
      "A URL da API deve usar HTTP(S) e não conter credenciais.",
      {
        code: "INVALID_API_URL",
        exitCode: 2,
      },
    );
  }
  parsed.password = "";
  return parsed.toString().replace(/\/+$/u, "");
}

export async function resolveCommandContext(options) {
  const input = options.input || {};
  const environment = { ...(options.environment || {}) };
  const toolDirectory = path.resolve(options.toolDirectory);
  const repositoryRoot = path.resolve(
    input.root || environment.BIAWS_ROOT || toolDirectory,
    input.root || environment.BIAWS_ROOT ? "." : "..",
  );
  const instancesDirectory = path.resolve(
    input.instancesDirectory ||
      environment.BIAWS_INSTANCES_DIR ||
      path.join(repositoryRoot, "instances"),
  );
  const instanceName = String(
    input.instance || environment.BIAWS_INSTANCE || "",
  ).trim();
  const instanceDirectory = path.resolve(
    input.instanceDirectory ||
      environment.BIAWS_INSTANCE_DIR ||
      (instanceName
        ? path.join(instancesDirectory, instanceName)
        : instancesDirectory),
  );
  const explicitEnvFile = String(
    input.envFile || environment.BIAWS_ENV_FILE || "",
  ).trim();
  const envFile = explicitEnvFile
    ? path.resolve(explicitEnvFile)
    : instanceName
      ? path.join(instanceDirectory, ".env")
      : "";
  const rootEnv = await readEnvFile(
    options.filesystem,
    path.join(repositoryRoot, ".env"),
  );
  const toolEnv = await readEnvFile(
    options.filesystem,
    path.join(toolDirectory, ".env"),
  );
  const instanceEnv = await readEnvFile(options.filesystem, envFile);
  const effectiveEnv = {
    ...rootEnv,
    ...environment,
    ...toolEnv,
    ...instanceEnv,
  };
  const apiUrl = normalizeApiUrl(
    input.apiUrl ||
      effectiveEnv.ISSUE_API_URL ||
      effectiveEnv.ISSUE_API_BASE_URL ||
      DEFAULT_API_URL,
  );
  const apiKey = String(input.apiKey || effectiveEnv.ISSUE_API_KEY || "");
  const workspaceId = String(
    input.workspaceId ||
      input.workspace ||
      effectiveEnv.ISSUE_WORKSPACE_ID ||
      "",
  ).trim();
  const projectDirectory = path.resolve(
    input.project || options.cwd || repositoryRoot,
  );

  return Object.freeze({
    apiKey,
    apiUrl,
    env: Object.freeze(effectiveEnv),
    envFile,
    instanceDirectory,
    instanceName,
    instancesDirectory,
    isCI: Boolean(options.terminal.isCI),
    isInteractive: Boolean(options.terminal.isInteractive),
    projectDirectory,
    repositoryRoot,
    toolDirectory,
    workspaceId,
  });
}

export async function resolveAuthenticatedContext(options) {
  const context = await resolveCommandContext(options);
  if (!context.apiKey) {
    throw new CliError(
      "Chave da API ausente. Defina ISSUE_API_KEY em um ambiente privado.",
      { code: "AUTHENTICATION_REQUIRED", exitCode: 2 },
    );
  }
  if (options.requireWorkspace && !context.workspaceId) {
    throw new CliError(
      "Workspace ausente. Informe --workspace ou defina ISSUE_WORKSPACE_ID.",
      { code: "WORKSPACE_REQUIRED", exitCode: 2 },
    );
  }
  return context;
}
