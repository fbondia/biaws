import { errorInfo } from "./errors.js";
const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const SENSITIVE_KEY =
  /authorization|cookie|password|passwd|token|secret|api.?key|connection.?string/iu;

function sanitizeText(value: unknown) {
  return String(value)
    .replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/(https?:\/\/)[^/@\s]+@/giu, "$1[REDACTED]@")
    .replace(
      /([?&](?:token|key|secret|password)\s*=)[^&#\s]+/giu,
      "$1[REDACTED]",
    );
}

export function serializeError(
  value: unknown,
  depth = 0,
): Record<string, unknown> {
  const error = errorInfo(value);
  if (!(value instanceof Error)) {
    return { name: "Error", message: sanitizeText(error) };
  }
  const result: Record<string, unknown> = {
    name: error.name,
    message: sanitizeText(error.message),
    ...(error.code === undefined ? {} : { code: String(error.code) }),
    ...(Number.isInteger(error.statusCode)
      ? { statusCode: error.statusCode }
      : {}),
    ...(typeof error.retryable === "boolean"
      ? { retryable: error.retryable }
      : {}),
    ...(error.stack ? { stack: sanitizeText(error.stack) } : {}),
  };
  if (depth < 2 && error.cause !== undefined) {
    result.cause = serializeError(error.cause, depth + 1);
  }
  return result;
}

function sanitize(
  value: unknown,
  key = "",
  seen = new WeakSet<object>(),
): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value instanceof Error) return serializeError(value);
  if (typeof value === "string") return sanitizeText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, "", seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entry]) => [
      entryKey,
      sanitize(entry, entryKey, seen),
    ]),
  );
}

function configuredLevel(level: unknown) {
  const normalized = String(level || "info").toLowerCase();
  return normalized in LEVELS ? (normalized as keyof typeof LEVELS) : "info";
}

export function createLogger({
  service,
  version,
  executionId,
  level = process.env.BIAWS_MCP_LOG_LEVEL,
  stream = process.stderr,
  now = () => new Date().toISOString(),
}: {
  service?: string;
  version?: string;
  executionId?: string;
  level?: string;
  stream?: { write: (line: string) => unknown };
  now?: () => string;
} = {}) {
  const minimumLevel = LEVELS[configuredLevel(level)];

  function log(
    entryLevel: keyof typeof LEVELS,
    event: string,
    fields: Record<string, unknown> = {},
  ) {
    if (LEVELS[entryLevel] < minimumLevel) return false;
    const record = sanitize({
      timestamp: now(),
      level: entryLevel,
      service,
      version,
      executionId,
      event,
      ...fields,
    });
    try {
      stream.write(`${JSON.stringify(record)}\n`);
      return true;
    } catch {
      // stderr is the diagnostic fallback. Logging failures must never recurse
      // or corrupt the MCP protocol on stdout.
      return false;
    }
  }

  return {
    debug: (event: string, fields?: Record<string, unknown>) =>
      log("debug", event, fields),
    info: (event: string, fields?: Record<string, unknown>) =>
      log("info", event, fields),
    warn: (event: string, fields?: Record<string, unknown>) =>
      log("warn", event, fields),
    error: (event: string, fields?: Record<string, unknown>) =>
      log("error", event, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;
