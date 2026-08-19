import path from "node:path";

import { CliError } from "./errors.js";
import { loadConfiguration, selectedProfile } from "./configuration.js";

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
  const projectDirectory = path.resolve(
    input.project || options.cwd || repositoryRoot,
  );
  const configuration = await loadConfiguration({
    cwd: projectDirectory,
    environment,
    filesystem: options.filesystem,
  });
  const profile = selectedProfile(configuration, input.profile);
  const workspaceConfiguration = configuration.workspace?.config || {};

  const explicitFileEnv = explicitEnvFile ? instanceEnv : {};
  const configuredApiUrl =
    input.apiUrl ||
    explicitFileEnv.BIAWS_API_URL ||
    explicitFileEnv.ISSUE_API_URL ||
    environment.BIAWS_API_URL ||
    environment.ISSUE_API_URL ||
    environment.ISSUE_API_BASE_URL ||
    workspaceConfiguration.apiUrl ||
    profile.config.apiUrl ||
    effectiveEnv.ISSUE_API_URL ||
    effectiveEnv.ISSUE_API_BASE_URL ||
    DEFAULT_API_URL;
  const configuredApiKey = String(
    input.apiKey ||
      explicitFileEnv.BIAWS_API_KEY ||
      explicitFileEnv.ISSUE_API_KEY ||
      environment.BIAWS_API_KEY ||
      environment.ISSUE_API_KEY ||
      profile.credentials.apiKey ||
      effectiveEnv.ISSUE_API_KEY ||
      "",
  );
  const configuredWorkspaceId = String(
    input.workspaceId ||
      input.workspace ||
      environment.BIAWS_WORKSPACE_ID ||
      workspaceConfiguration.workspaceId ||
      effectiveEnv.BIAWS_WORKSPACE_ID ||
      "",
  ).trim();

  return Object.freeze({
    apiKey: configuredApiKey,
    apiUrl: normalizeApiUrl(configuredApiUrl),
    configuration,
    env: Object.freeze(effectiveEnv),
    envFile,
    instanceDirectory,
    instanceName,
    instancesDirectory,
    isCI: Boolean(options.terminal.isCI),
    isInteractive: Boolean(options.terminal.isInteractive),
    profileName: profile.name,
    projectDirectory: configuration.workspace?.directory || projectDirectory,
    repositoryRoot,
    toolDirectory,
    workspaceId: configuredWorkspaceId,
  });
}

export async function resolveAuthenticatedContext(options) {
  const context = await resolveCommandContext(options);
  if (!context.apiKey) {
    throw new CliError(
      "Chave de API ausente. Execute `biaws config login` ou defina BIAWS_API_KEY em um ambiente privado.",
      { code: "AUTHENTICATION_REQUIRED", exitCode: 2 },
    );
  }
  if (options.requireWorkspace && !context.workspaceId) {
    throw new CliError(
      "Workspace ausente. Execute `biaws workspace init` nesta pasta ou informe --workspace.",
      { code: "WORKSPACE_REQUIRED", exitCode: 2 },
    );
  }
  return context;
}
