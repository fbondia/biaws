import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "../../shared/index.js";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function readText(env, name, fallback = "") {
  const value = env[name];
  return value === undefined || value === null || !String(value).trim()
    ? fallback
    : String(value).trim();
}

function readBoolean(env, name, fallback) {
  const raw = readText(env, name, "");
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be a boolean`);
}

function readInteger(env, name, fallback, { min, max }) {
  const raw = readText(env, name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function readJsonObject(env, name, fallback = {}) {
  const raw = readText(env, name, "");
  if (!raw) return fallback;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must contain a JSON object`);
  }
  return value;
}

function readList(env, name, fallback = []) {
  const values = readText(env, name, "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/u, "");
}

export function getExecutorConfig(env = process.env) {
  const enabled = readBoolean(env, "BIAWS_MONITOR_EXECUTOR_ENABLED", true);
  const apiUrl = trimTrailingSlash(
    readText(env, "BIAWS_MONITOR_EXECUTOR_API_URL", "http://127.0.0.1:3100"),
  );
  const apiKey = readText(env, "BIAWS_MONITOR_EXECUTOR_API_KEY");
  const workspaceId = readText(env, "BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID");
  if (enabled && (!apiKey || !workspaceId)) {
    throw new Error(
      "BIAWS_MONITOR_EXECUTOR_API_KEY and BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID are required when the executor is enabled",
    );
  }

  const leaseSeconds = readInteger(
    env,
    "BIAWS_MONITOR_EXECUTOR_LEASE_SECONDS",
    60,
    { min: 10, max: 300 },
  );
  return {
    enabled,
    apiUrl,
    apiKey,
    workspaceId,
    executorId: readText(
      env,
      "BIAWS_MONITOR_EXECUTOR_ID",
      `${os.hostname()}-${process.pid}`,
    ).slice(0, 160),
    concurrency: readInteger(env, "BIAWS_MONITOR_EXECUTOR_CONCURRENCY", 4, {
      min: 1,
      max: 25,
    }),
    leaseSeconds,
    renewIntervalMs: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_RENEW_INTERVAL_MS",
      Math.max(1_000, Math.floor((leaseSeconds * 1_000) / 3)),
      { min: 250, max: 120_000 },
    ),
    pollIntervalMs: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_POLL_INTERVAL_MS",
      15_000,
      { min: 100, max: 60_000 },
    ),
    requestTimeoutMs: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_REQUEST_TIMEOUT_MS",
      10_000,
      { min: 250, max: 120_000 },
    ),
    retryAttempts: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_RETRY_ATTEMPTS",
      4,
      { min: 1, max: 10 },
    ),
    retryBaseMs: readInteger(env, "BIAWS_MONITOR_EXECUTOR_RETRY_BASE_MS", 500, {
      min: 10,
      max: 30_000,
    }),
    retryMaxMs: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_RETRY_MAX_MS",
      15_000,
      { min: 10, max: 120_000 },
    ),
    shutdownGraceMs: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_SHUTDOWN_GRACE_MS",
      30_000,
      { min: 100, max: 300_000 },
    ),
    readinessMaxAgeMs: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_READINESS_MAX_AGE_MS",
      60_000,
      { min: 1_000, max: 600_000 },
    ),
    healthHost: readText(env, "BIAWS_MONITOR_EXECUTOR_HEALTH_HOST", "0.0.0.0"),
    healthPort: readInteger(env, "BIAWS_MONITOR_EXECUTOR_HEALTH_PORT", 3110, {
      min: 0,
      max: 65_535,
    }),
    providerEvidenceMaxBytes: readInteger(
      env,
      "BIAWS_MONITOR_EXECUTOR_EVIDENCE_MAX_BYTES",
      8_000,
      { min: 1_024, max: 8_000 },
    ),
    rest: {
      allowedHosts: readList(env, "BIAWS_MONITOR_REST_ALLOWED_HOSTS"),
      allowedMethods: readList(env, "BIAWS_MONITOR_REST_ALLOWED_METHODS", [
        "GET",
        "HEAD",
      ]),
      allowPrivateAddresses: readBoolean(
        env,
        "BIAWS_MONITOR_REST_ALLOW_PRIVATE_ADDRESSES",
        false,
      ),
      maxRedirects: readInteger(env, "BIAWS_MONITOR_REST_MAX_REDIRECTS", 3, {
        min: 0,
        max: 10,
      }),
    },
    shell: {
      root: path.resolve(
        readText(env, "BIAWS_MONITOR_SHELL_ROOT", "/opt/biaws-monitor-scripts"),
      ),
      scripts: readJsonObject(env, "BIAWS_MONITOR_SHELL_SCRIPTS", {}),
    },
    referenceEnvironment: readJsonObject(
      env,
      "BIAWS_MONITOR_REFERENCE_ENV_MAP",
      {},
    ),
  };
}

export function loadExecutorConfig() {
  loadEnv(TOOL_DIR);
  return getExecutorConfig();
}
