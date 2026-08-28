const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const SENSITIVE_KEY =
  /authorization|cookie|password|passwd|token|secret|api.?key|connection.?string/iu;

function sanitizeText(value) {
  return String(value)
    .replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/(https?:\/\/)[^/@\s]+@/giu, "$1[REDACTED]@")
    .replace(
      /([?&](?:token|key|secret|password)\s*=)[^&#\s]+/giu,
      "$1[REDACTED]",
    );
}

export function serializeError(error, depth = 0) {
  if (!(error instanceof Error)) {
    return { name: "Error", message: sanitizeText(error) };
  }
  const result = {
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

function sanitize(value, key = "", seen = new WeakSet()) {
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

function configuredLevel(level) {
  const normalized = String(level || "info").toLowerCase();
  return LEVELS[normalized] === undefined ? "info" : normalized;
}

export function createLogger({
  service,
  version,
  executionId,
  level = process.env.BIAWS_MCP_LOG_LEVEL,
  stream = process.stderr,
  now = () => new Date().toISOString(),
} = {}) {
  const minimumLevel = LEVELS[configuredLevel(level)];

  function log(entryLevel, event, fields = {}) {
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
    debug: (event, fields) => log("debug", event, fields),
    info: (event, fields) => log("info", event, fields),
    warn: (event, fields) => log("warn", event, fields),
    error: (event, fields) => log("error", event, fields),
  };
}
