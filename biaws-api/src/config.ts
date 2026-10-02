import path from "node:path";
import { API_ROOT } from "./helpers/runtimePaths.js";

import { loadEnv } from "../../shared/index.js";

export const TOOL_DIR = API_ROOT;

loadEnv(TOOL_DIR);

function readEnv<T extends string | undefined>(keys: string[], fallback: T): string | T {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return fallback;
}

function readNumberEnv(keys: string[], fallback: number) {
  const rawValue = readEnv(keys, undefined);
  if (rawValue === undefined) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid numeric environment value: ${rawValue}`);
  }
  return value;
}

function readCsvEnv(keys: string[], fallback: string[] = []) {
  const rawValue = readEnv(keys, undefined);
  if (rawValue === undefined) return fallback;

  return rawValue
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
}

function readBooleanEnv(keys: string[], fallback: boolean) {
  const rawValue = readEnv(keys, undefined);
  if (rawValue === undefined) return fallback;

  const value = rawValue.toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  throw new Error(`Invalid boolean environment value: ${rawValue}`);
}

function readRateLimitConfig(
  prefix: string,
  defaults: { enabled: boolean; windowSeconds: number; maxRequests: number },
) {
  return {
    enabled: readBooleanEnv([`${prefix}_ENABLED`], defaults.enabled),
    windowSeconds: readNumberEnv([`${prefix}_WINDOW_SECONDS`], defaults.windowSeconds),
    maxRequests: readNumberEnv([`${prefix}_MAX_REQUESTS`], defaults.maxRequests),
  };
}

export function getAuditRetentionDays() {
  const days = Number(readEnv(["BIAWS_AUDIT_RETENTION_DAYS"], "0"));
  if (!Number.isInteger(days) || days < 0 || days > 3_650) {
    throw new Error("BIAWS_AUDIT_RETENTION_DAYS must be an integer between 0 and 3650");
  }
  return days;
}

export function getServerConfig() {
  const host = readEnv(["BIAWS_API_HOST", "HOST"], "127.0.0.1");
  const port = readNumberEnv(["BIAWS_API_PORT", "PORT"], 3100);

  return {
    host,
    port,
    audit: { retentionDays: getAuditRetentionDays() },
    maxEmlBytes: readNumberEnv(["BIAWS_API_MAX_EML_BYTES"], 25 * 1024 * 1024),
    maxAttachmentBytes: readNumberEnv(["BIAWS_API_MAX_ATTACHMENT_BYTES"], 50 * 1024 * 1024),
    maxJsonBytes: readNumberEnv(["BIAWS_API_MAX_JSON_BYTES"], 4 * 1024 * 1024),
    logging: {
      includeHealthChecks: readBooleanEnv(["BIAWS_API_LOG_HEALTH_REQUESTS"], false),
    },
    docs: {
      enabled: readBooleanEnv(["BIAWS_API_DOCS_ENABLED"], process.env.NODE_ENV !== "production"),
    },
    rateLimit: {
      api: readRateLimitConfig("BIAWS_API_RATE_LIMIT", {
        enabled: true,
        windowSeconds: 60,
        maxRequests: 300,
      }),
      auth: readRateLimitConfig("BETTER_AUTH_RATE_LIMIT", {
        enabled: true,
        windowSeconds: 10,
        maxRequests: 100,
      }),
      apiKey: readRateLimitConfig("BIAWS_API_KEY_RATE_LIMIT", {
        enabled: true,
        windowSeconds: 60 * 60,
        maxRequests: 1_000,
      }),
    },
    auth: {
      secret: readEnv(["BETTER_AUTH_SECRET"], undefined),
      baseUrl: readEnv(["BETTER_AUTH_URL"], `http://${host}:${port}`),
      secureCookies: readBooleanEnv(["BETTER_AUTH_SECURE_COOKIES"], process.env.NODE_ENV === "production"),
      trustedOrigins: readCsvEnv(["BETTER_AUTH_TRUSTED_ORIGINS"], ["http://127.0.0.1:4400"]),
      trustedProxies: readCsvEnv(["BETTER_AUTH_TRUSTED_PROXIES"], []),
    },
    secrets: {
      provider: readEnv(["BIAWS_SECRETS_PROVIDER"], "local"),
      maxFileBytes: readNumberEnv(["BIAWS_SECRETS_MAX_FILE_BYTES"], 5 * 1024 * 1024),
      local: {
        directory: path.resolve(
          readEnv(["BIAWS_SECRET_FILES_PATH", "BIAWS_SECRETS_DIR"], path.resolve(TOOL_DIR, "../secrets-data")),
        ),
        keyFile: path.resolve(
          readEnv(
            ["BIAWS_SECRETS_KEY_PATH", "BIAWS_SECRETS_KEY_FILE"],
            path.resolve(TOOL_DIR, "../.secrets-master-key"),
          ),
        ),
        maxBytes: readNumberEnv(["BIAWS_SECRETS_MAX_FILE_BYTES"], 5 * 1024 * 1024),
      },
    },
  };
}
