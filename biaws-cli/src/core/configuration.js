import path from "node:path";

import { CliError } from "./errors.js";

export const CONFIG_VERSION = 1;
export const DEFAULT_PROFILE = "default";

function missing(error) {
  return error?.code === "ENOENT";
}

async function readJson(filesystem, filePath, kind) {
  if (!filePath) return null;
  try {
    const value = JSON.parse(await filesystem.readFile(filePath, "utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new TypeError("a raiz deve ser um objeto");
    }
    if (value.version !== undefined && value.version !== CONFIG_VERSION) {
      throw new TypeError(`versão ${value.version} não suportada`);
    }
    return value;
  } catch (error) {
    if (missing(error)) return null;
    throw new CliError(
      `Não foi possível ler ${kind} em ${filePath}: ${error.message}.`,
      { code: "CONFIGURATION_READ_FAILED", cause: error },
    );
  }
}

export function resolveConfigurationPaths(environment = {}) {
  const explicit = String(environment.BIAWS_CONFIG_HOME || "").trim();
  const xdg = String(environment.XDG_CONFIG_HOME || "").trim();
  const home = String(environment.HOME || "").trim();
  const directory = explicit
    ? path.resolve(explicit)
    : xdg
      ? path.resolve(xdg, "biaws")
      : home
        ? path.resolve(home, ".config", "biaws")
        : "";
  return Object.freeze({
    directory,
    configFile: directory ? path.join(directory, "config.json") : "",
    credentialsFile: directory ? path.join(directory, "credentials.json") : "",
  });
}

export async function findWorkspaceConfiguration(filesystem, startDirectory) {
  let directory = path.resolve(startDirectory);
  while (true) {
    const filePath = path.join(directory, ".biaws", "config.json");
    const config = await readJson(
      filesystem,
      filePath,
      "a configuração do workspace",
    );
    if (config) return Object.freeze({ config, directory, filePath });
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

export async function loadConfiguration(options) {
  const paths = resolveConfigurationPaths(options.environment);
  const [globalConfig, credentials, workspace] = await Promise.all([
    readJson(options.filesystem, paths.configFile, "a configuração global"),
    readJson(options.filesystem, paths.credentialsFile, "as credenciais"),
    findWorkspaceConfiguration(options.filesystem, options.cwd),
  ]);
  return Object.freeze({
    paths,
    global: globalConfig || { version: CONFIG_VERSION, profiles: {} },
    credentials: credentials || { version: CONFIG_VERSION, profiles: {} },
    workspace,
  });
}

async function writeJson(filesystem, filePath, value, mode) {
  await filesystem.mkdir(path.dirname(filePath), { recursive: true });
  await filesystem.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode,
  });
  await filesystem.chmod?.(filePath, mode);
}

export async function writeGlobalConfiguration(filesystem, paths, config) {
  if (!paths.configFile) {
    throw new CliError(
      "Não foi possível determinar o diretório de configuração global. Defina HOME ou BIAWS_CONFIG_HOME.",
      { code: "CONFIGURATION_HOME_REQUIRED", exitCode: 2 },
    );
  }
  await writeJson(
    filesystem,
    paths.configFile,
    { version: CONFIG_VERSION, ...config },
    0o600,
  );
}

export async function writeCredentials(filesystem, paths, credentials) {
  if (!paths.credentialsFile) {
    throw new CliError(
      "Não foi possível determinar o diretório de credenciais. Defina HOME ou BIAWS_CONFIG_HOME.",
      { code: "CONFIGURATION_HOME_REQUIRED", exitCode: 2 },
    );
  }
  await writeJson(
    filesystem,
    paths.credentialsFile,
    { version: CONFIG_VERSION, ...credentials },
    0o600,
  );
}

export async function writeWorkspaceConfiguration(
  filesystem,
  projectDirectory,
  config,
) {
  const filePath = path.join(
    path.resolve(projectDirectory),
    ".biaws",
    "config.json",
  );
  await writeJson(
    filesystem,
    filePath,
    { version: CONFIG_VERSION, ...config },
    0o644,
  );
  return filePath;
}

export function selectedProfile(configuration, requestedProfile) {
  const workspaceConfig = configuration.workspace?.config || {};
  const name = String(
    requestedProfile ||
      workspaceConfig.profile ||
      configuration.global.currentProfile ||
      DEFAULT_PROFILE,
  ).trim();
  return Object.freeze({
    name,
    config: configuration.global.profiles?.[name] || {},
    credentials: configuration.credentials.profiles?.[name] || {},
  });
}
