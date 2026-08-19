import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value.replace(/\\n/g, "\n");
  }

  return parsed;
}

function applyEnvFile(envPath, override) {
  if (typeof process.loadEnvFile === "function" && !override) {
    process.loadEnvFile(envPath);
    return;
  }

  for (const [key, value] of Object.entries(
    parseEnvFile(readFileSync(envPath, "utf8")),
  )) {
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

export function loadEnv(toolDir, options = {}) {
  const envName = options.envName || ".env";
  const preserved = new Map(
    (options.preserve || [])
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  const explicitEnvPath = String(
    options.envPath || process.env.BIAWS_ENV_FILE || "",
  ).trim();
  const candidates = [
    ...(existsSync(path.resolve(toolDir, "..", "compose.yaml"))
      ? [{ envPath: path.resolve(toolDir, "..", envName), override: false }]
      : []),
    {
      envPath: path.resolve(toolDir, envName),
      override: true,
    },
    ...(explicitEnvPath
      ? [{ envPath: path.resolve(explicitEnvPath), override: true }]
      : []),
  ];
  const loaded = [];

  for (const { envPath, override } of candidates) {
    if (loaded.includes(envPath) || !existsSync(envPath)) continue;
    applyEnvFile(envPath, override);
    loaded.push(envPath);
  }

  for (const [key, value] of preserved) process.env[key] = value;
  return { loaded };
}
