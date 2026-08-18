import path from "node:path";

import { CliError } from "../core/errors.js";
import { parseEnv } from "../core/context.js";

const PORT_FIELDS = Object.freeze({
  mongoPort: "MONGO_PORT",
  apiPort: "ISSUE_API_PORT",
  uiPort: "ISSUE_UI_PORT",
});

const STORAGE_FIELDS = Object.freeze({
  mongoPath: "BIAWS_MONGO_DATA_PATH",
  issuePath: "BIAWS_ISSUE_FILES_PATH",
  requestPath: "BIAWS_REQUEST_FILES_PATH",
  documentPath: "BIAWS_DOCUMENT_FILES_PATH",
  secretPath: "BIAWS_SECRET_FILES_PATH",
});

function usageError(message, code, details) {
  throw new CliError(message, { code, details, exitCode: 2 });
}

function integer(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    usageError(`${label} deve ser um inteiro positivo.`, "INVALID_INTEGER");
  }
  return parsed;
}

export function validateInstanceName(value) {
  const name = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/u.test(name)) {
    usageError(
      "Nome de instância inválido: use letras minúsculas, números e hífens.",
      "INVALID_INSTANCE_NAME",
    );
  }
  return name;
}

export function validatePort(value, label = "Porta") {
  const port = integer(value, label);
  if (port > 65_535) usageError(`${label} inválida.`, "INVALID_PORT");
  return port;
}

export function validatePublicUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    usageError("URL pública inválida.", "INVALID_PUBLIC_URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    usageError(
      "A URL pública deve ser uma origem HTTP(S), sem credenciais, caminho, query ou fragmento.",
      "INVALID_PUBLIC_URL",
    );
  }
  return url.origin;
}

export function validateStoragePath(value, label) {
  if (!value) return "";
  const resolved = path.resolve(String(value));
  if (
    !path.isAbsolute(String(value)) ||
    resolved === path.parse(resolved).root
  ) {
    usageError(
      `${label} deve ser absoluto e não pode ser a raiz.`,
      "UNSAFE_STORAGE_PATH",
    );
  }
  if (/[#$:'"\\]/u.test(String(value))) {
    usageError(
      `${label} contém caractere incompatível com Compose.`,
      "UNSAFE_STORAGE_PATH",
    );
  }
  return resolved;
}

function validateDistinctPaths(paths) {
  const populated = paths.filter(Boolean).map((value) => path.resolve(value));
  for (let index = 0; index < populated.length; index += 1) {
    for (let nested = index + 1; nested < populated.length; nested += 1) {
      const left = `${populated[index]}${path.sep}`;
      const right = `${populated[nested]}${path.sep}`;
      if (left.startsWith(right) || right.startsWith(left)) {
        usageError(
          "Diretórios persistentes não podem ser iguais nem aninhados.",
          "OVERLAPPING_STORAGE_PATHS",
        );
      }
    }
  }
}

async function readOptional(filesystem, filePath) {
  try {
    return await filesystem.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function listInstances(context, filesystem) {
  let entries;
  try {
    entries = await filesystem.readdir(context.instancesDirectory, {
      withFileTypes: true,
    });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const instances = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(context.instancesDirectory, entry.name);
    const contents = await readOptional(
      filesystem,
      path.join(directory, ".env"),
    );
    if (contents === null) continue;
    const env = parseEnv(contents);
    instances.push({
      name: entry.name,
      directory,
      envFile: path.join(directory, ".env"),
      mongoPort: Number(env.MONGO_PORT || 27_017),
      apiPort: Number(env.ISSUE_API_PORT || 3_100),
      uiPort: Number(env.ISSUE_UI_PORT || 4_400),
      publicUrl:
        env.BIAWS_PUBLIC_URL ||
        `http://localhost:${env.ISSUE_UI_PORT || 4_400}`,
      storage: Object.values(STORAGE_FIELDS).some((key) => env[key])
        ? "directories"
        : "volumes",
      env,
    });
  }
  return instances.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getInstance(context, filesystem, name) {
  const instances = await listInstances(context, filesystem);
  const selected = String(name || context.instanceName || "").trim();
  if (!selected && instances.length === 1) return instances[0];
  if (!selected) {
    usageError(
      "Informe a instância ou defina BIAWS_INSTANCE.",
      "INSTANCE_REQUIRED",
    );
  }
  const normalized = validateInstanceName(selected);
  const instance = instances.find((item) => item.name === normalized);
  if (!instance) {
    throw new CliError(`Instância não encontrada: ${normalized}.`, {
      code: "INSTANCE_NOT_FOUND",
      exitCode: 3,
    });
  }
  return instance;
}

function resolveStorage(values, existing) {
  if (values.storage === "volumes") {
    if (Object.keys(STORAGE_FIELDS).some((field) => values[field])) {
      usageError(
        "Storage em volumes não pode ser combinado com caminhos do host.",
        "STORAGE_MODE_CONFLICT",
      );
    }
    return Object.fromEntries(
      Object.keys(STORAGE_FIELDS).map((key) => [key, ""]),
    );
  }
  const root = validateStoragePath(values.storageRoot, "Raiz de storage");
  const storage = {};
  const defaults = {
    mongoPath: "mongo",
    issuePath: "issues",
    requestPath: "requests",
    documentPath: "documents",
    secretPath: "secrets",
  };
  for (const [name, envName] of Object.entries(STORAGE_FIELDS)) {
    storage[name] = validateStoragePath(
      values[name] ||
        (root ? path.join(root, defaults[name]) : existing?.env[envName]),
      name,
    );
  }
  if (Object.values(storage).some((value) => !value)) {
    usageError(
      "Informe --storage-root ou todos os caminhos para storage em diretórios.",
      "INCOMPLETE_STORAGE_PATHS",
    );
  }
  validateDistinctPaths(Object.values(storage));
  return storage;
}

export async function buildSetupConfiguration(values, context, filesystem) {
  const name = validateInstanceName(values.name);
  const instances = await listInstances(context, filesystem);
  const existing = instances.find((item) => item.name === name);
  const ports = {
    mongoPort: validatePort(
      values.mongoPort ?? existing?.mongoPort ?? 27_017,
      "Porta MongoDB",
    ),
    apiPort: validatePort(
      values.apiPort ?? existing?.apiPort ?? 3_100,
      "Porta API",
    ),
    uiPort: validatePort(
      values.uiPort ?? existing?.uiPort ?? 4_400,
      "Porta UI",
    ),
  };
  if (new Set(Object.values(ports)).size !== 3) {
    usageError(
      "MongoDB, API e UI devem usar portas distintas.",
      "PORT_COLLISION",
    );
  }
  for (const instance of instances) {
    if (instance.name === name) continue;
    const reserved = new Set([
      instance.mongoPort,
      instance.apiPort,
      instance.uiPort,
    ]);
    for (const port of Object.values(ports)) {
      if (reserved.has(port)) {
        usageError(
          `A porta ${port} já pertence à instância ${instance.name}.`,
          "PORT_COLLISION",
        );
      }
    }
  }
  const storage = resolveStorage(values, existing);
  const previousStorage = existing
    ? Object.fromEntries(
        Object.entries(STORAGE_FIELDS).map(([key, envName]) => [
          key,
          existing.env[envName] || "",
        ]),
      )
    : null;
  const storageChanged = Boolean(
    previousStorage &&
    Object.keys(STORAGE_FIELDS).some(
      (key) => previousStorage[key] !== storage[key],
    ),
  );
  return Object.freeze({
    name,
    ...ports,
    ...storage,
    publicUrl: validatePublicUrl(
      values.publicUrl || `http://localhost:${ports.uiPort}`,
    ),
    storage: values.storage,
    storageChanged,
    adminEmail: String(values.adminEmail).trim(),
    adminName: String(values.adminName).trim(),
    adminPassword: values.adminPassword,
    demoSeed: Boolean(values.demoSeed),
    disableRateLimit: Boolean(values.disableRateLimit),
    apiRateLimitMax: integer(values.apiRateLimitMax, "Rate limit da API"),
    apiRateLimitWindow: integer(values.apiRateLimitWindow, "Janela da API"),
    authRateLimitMax: integer(
      values.authRateLimitMax,
      "Rate limit de autenticação",
    ),
    authRateLimitWindow: integer(
      values.authRateLimitWindow,
      "Janela de autenticação",
    ),
    apiKeyRateLimitMax: integer(
      values.apiKeyRateLimitMax,
      "Rate limit da API key",
    ),
    apiKeyRateLimitWindow: integer(
      values.apiKeyRateLimitWindow,
      "Janela da API key",
    ),
    existing: Boolean(existing),
  });
}

export function setupArguments(configuration, context) {
  const args = [
    path.join(context.repositoryRoot, "scripts", "setup-server.sh"),
    "--instance",
    configuration.name,
    "--instances-dir",
    context.instancesDirectory,
    "--public-url",
    configuration.publicUrl,
    "--mongo-port",
    String(configuration.mongoPort),
    "--api-port",
    String(configuration.apiPort),
    "--ui-port",
    String(configuration.uiPort),
    "--api-rate-limit-max",
    String(configuration.apiRateLimitMax),
    "--api-rate-limit-window-seconds",
    String(configuration.apiRateLimitWindow),
    "--auth-rate-limit-max",
    String(configuration.authRateLimitMax),
    "--auth-rate-limit-window-seconds",
    String(configuration.authRateLimitWindow),
    "--api-key-rate-limit-max",
    String(configuration.apiKeyRateLimitMax),
    "--api-key-rate-limit-window-seconds",
    String(configuration.apiKeyRateLimitWindow),
  ];
  if (configuration.disableRateLimit) args.push("--disable-rate-limit");
  if (configuration.storage === "volumes") args.push("--use-docker-volumes");
  else {
    for (const [name, flag] of [
      ["mongoPath", "--mongo-data-path"],
      ["issuePath", "--issue-files-path"],
      ["requestPath", "--request-files-path"],
      ["documentPath", "--document-files-path"],
      ["secretPath", "--secret-files-path"],
    ])
      args.push(flag, configuration[name]);
  }
  return args;
}

export async function executeSetup(
  configuration,
  context,
  processRunner,
  environment,
  options = {},
) {
  const args = setupArguments(configuration, context);
  await processRunner.run("bash", args, {
    cwd: context.repositoryRoot,
    env: {
      ...environment,
      BIAWS_BOOTSTRAP_ADMIN_EMAIL: configuration.adminEmail,
      BIAWS_BOOTSTRAP_ADMIN_NAME: configuration.adminName,
      BIAWS_BOOTSTRAP_ADMIN_PASSWORD: configuration.adminPassword,
      BIAWS_SKIP_DEMO_SEED: configuration.demoSeed ? "0" : "1",
    },
    secrets: [configuration.adminPassword],
    silent: Boolean(options.silent),
  });
  return {
    name: configuration.name,
    ui: configuration.publicUrl,
    api: `http://127.0.0.1:${configuration.apiPort}`,
    mongo: `mongodb://127.0.0.1:${configuration.mongoPort}/biaws`,
    storage: configuration.storage,
    storageChanged: configuration.storageChanged,
    commands: {
      status: `biaws instance status ${configuration.name}`,
      start: `biaws instance start ${configuration.name}`,
      stop: `biaws instance stop ${configuration.name}`,
    },
  };
}

export function composeArguments(instance, context, operation) {
  const base = [
    "compose",
    "--project-directory",
    context.repositoryRoot,
    "--file",
    path.join(context.repositoryRoot, "compose.yaml"),
    "--env-file",
    instance.envFile,
    "--project-name",
    `biaws-${instance.name}`,
  ];
  if (operation === "start") return [...base, "up", "-d", "--wait"];
  if (operation === "stop") return [...base, "stop"];
  return [...base, "ps", "--format", "json"];
}

export async function operateInstance(
  instance,
  context,
  processRunner,
  operation,
) {
  const result = await processRunner.run(
    "docker",
    composeArguments(instance, context, operation),
    { cwd: context.repositoryRoot, silent: true },
  );
  return { instance: instance.name, operation, output: result.stdout.trim() };
}

export { PORT_FIELDS, STORAGE_FIELDS };
