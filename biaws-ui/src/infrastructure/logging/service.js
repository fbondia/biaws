const DEFAULT_LIMITS = Object.freeze({
  maxArrayItems: 20,
  maxDepth: 5,
  maxEntriesPerWindow: 100,
  maxObjectKeys: 50,
  maxStackLength: 4_000,
  maxStringLength: 1_000,
  windowMs: 60_000,
});

const LEVELS = new Set(["debug", "info", "warn", "error"]);
const EVENT_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/;
const REDACTED = "[REDACTED]";
const OMITTED = "[OMITTED]";

const SENSITIVE_KEYS = new Set([
  "apikey",
  "authorization",
  "connectionstring",
  "cookie",
  "credential",
  "credentials",
  "password",
  "passwd",
  "privatekey",
  "pwd",
  "refreshtoken",
  "secret",
  "setcookie",
  "token",
  "accesstoken",
]);

const PAYLOAD_KEYS = new Set([
  "body",
  "headers",
  "payload",
  "querystring",
  "raw",
  "requestbody",
  "responsebody",
]);

function normalizedKey(key) {
  return String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key) {
  const comparableKey = normalizedKey(key);
  return (
    SENSITIVE_KEYS.has(comparableKey) ||
    /(password|passwd|pwd|secret|token|authorization|cookie|credential|privatekey|apikey|connectionstring)/.test(
      comparableKey,
    )
  );
}

function truncate(value, maxLength) {
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…[truncated]`;
}

function redactJsonFragments(value, limits) {
  return value.replace(
    /\{[^{}\r\n]{1,4000}\}|\[[^\[\]\r\n]{1,4000}\]/g,
    (fragment) => {
      try {
        return JSON.stringify(sanitizeLogValue(JSON.parse(fragment), limits));
      } catch {
        return fragment;
      }
    },
  );
}

function redactText(value, maxLength, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options, maxStringLength: maxLength };
  const redacted = redactJsonFragments(String(value), limits)
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/gi,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^:@/\s]+:[^@/\s]+@/gi, "$1[REDACTED]@")
    .replace(/\b(Bearer|Basic)\s+[^\s,;&]+/gi, "$1 [REDACTED]")
    .replace(
      /([?&](?:password|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key)=)[^&#\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(
      /["']?\b(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|authorization|cookie)\b["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|.*?)(?=\s+["']?[a-z][a-z0-9_-]*["']?\s*[:=]|[,};&\r\n]|$)/gi,
      "$1=[REDACTED]",
    );
  return truncate(redacted, maxLength);
}

function sanitizeValue(value, limits, depth, seen) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return redactText(value, limits.maxStringLength, limits);
  }
  if (["number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "bigint") return String(value);
  if (["function", "symbol"].includes(typeof value)) return undefined;
  if (seen.has(value)) return "[CIRCULAR]";
  if (depth >= limits.maxDepth) return "[MAX_DEPTH]";

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value
        .slice(0, limits.maxArrayItems)
        .map((item) => sanitizeValue(item, limits, depth + 1, seen));
    }

    const sanitized = {};
    const entries = Object.entries(value).slice(0, limits.maxObjectKeys);
    for (const [key, item] of entries) {
      const comparableKey = normalizedKey(key);
      if (isSensitiveKey(key)) {
        sanitized[key] = REDACTED;
        continue;
      }
      if (PAYLOAD_KEYS.has(comparableKey)) {
        sanitized[key] = OMITTED;
        continue;
      }
      const sanitizedItem = sanitizeValue(item, limits, depth + 1, seen);
      if (sanitizedItem !== undefined) sanitized[key] = sanitizedItem;
    }
    return sanitized;
  } catch {
    return "[UNSERIALIZABLE]";
  } finally {
    seen.delete(value);
  }
}

export function sanitizeLogValue(value, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  return sanitizeValue(value, limits, 0, new WeakSet());
}

export function normalizeLogError(error, options = {}, depth = 0) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  if (depth >= limits.maxDepth)
    return { message: "[MAX_DEPTH]", name: "Error" };

  const errorLike =
    error instanceof Error ||
    (error !== null &&
      typeof error === "object" &&
      ["code", "message", "name", "stack", "statusCode"].some(
        (key) => error[key] !== undefined,
      ));

  if (!errorLike) {
    return {
      message: redactText(String(error), limits.maxStringLength, limits),
      name: "Error",
    };
  }

  const normalized = {
    message: redactText(
      error.message || error.name || "Error",
      limits.maxStringLength,
      limits,
    ),
    name: redactText(error.name || "Error", limits.maxStringLength, limits),
  };
  if (error.code !== undefined) {
    normalized.code = sanitizeLogValue(error.code, limits);
  }
  if (error.statusCode !== undefined) {
    normalized.statusCode = sanitizeLogValue(error.statusCode, limits);
  }
  if (error.stack) {
    normalized.stack = redactText(error.stack, limits.maxStackLength, limits);
  }
  if (error.cause !== undefined) {
    normalized.cause = normalizeLogError(error.cause, limits, depth + 1);
  }
  return normalized;
}

function validateEvent(event) {
  const normalized = String(event || "").trim();
  if (!EVENT_PATTERN.test(normalized)) {
    throw new TypeError(
      "Log events must follow the dominio.acao.resultado convention",
    );
  }
  return normalized;
}

function timestampFrom(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Logger clock must return a valid date");
  }
  return date;
}

export function createLogger({
  context = {},
  limits: limitOverrides = {},
  now = () => new Date(),
  service = "biaws-ui",
  transports = [],
} = {}) {
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...limitOverrides });
  let sharedContext = sanitizeLogValue(context, limits) || {};
  let windowStartedAt = 0;
  let entriesInWindow = 0;
  let droppedEntries = 0;
  const pendingWrites = new Set();

  function withinVolumeLimit(time) {
    const currentTime = time.getTime();
    if (
      !windowStartedAt ||
      currentTime < windowStartedAt ||
      currentTime - windowStartedAt >= limits.windowMs
    ) {
      windowStartedAt = currentTime;
      entriesInWindow = 0;
    }
    if (entriesInWindow >= limits.maxEntriesPerWindow) {
      droppedEntries += 1;
      return false;
    }
    entriesInWindow += 1;
    return true;
  }

  function deliver(record) {
    for (const transport of transports) {
      try {
        const result = transport?.write?.(record);
        if (result && typeof result.then === "function") {
          const pending = Promise.resolve(result)
            .catch(() => {
              droppedEntries += 1;
            })
            .finally(() => pendingWrites.delete(pending));
          pendingWrites.add(pending);
        }
      } catch {
        droppedEntries += 1;
      }
    }
  }

  function log(level, event, { context: eventContext, error, message } = {}) {
    if (!LEVELS.has(level))
      throw new TypeError(`Unsupported log level: ${level}`);
    const stableEvent = validateEvent(event);
    const time = timestampFrom(now);
    if (!withinVolumeLimit(time)) return null;

    const record = {
      context: sanitizeLogValue(
        { ...sharedContext, ...(eventContext || {}) },
        limits,
      ),
      event: stableEvent,
      level,
      message: redactText(
        message || stableEvent,
        limits.maxStringLength,
        limits,
      ),
      service,
      timestamp: time.toISOString(),
    };
    if (error !== undefined) {
      record.error = normalizeLogError(error, limits);
    }
    deliver(Object.freeze(record));
    return record;
  }

  return Object.freeze({
    clearContext(keys) {
      const next = { ...sharedContext };
      for (const key of keys) delete next[key];
      sharedContext = next;
    },
    debug: (event, details) => log("debug", event, details),
    error: (event, details) => log("error", event, details),
    async flush() {
      await Promise.allSettled([...pendingWrites]);
      await Promise.allSettled(
        transports.map(async (transport) => {
          try {
            await transport?.flush?.();
          } catch {
            droppedEntries += 1;
          }
        }),
      );
    },
    getDiagnostics: () => Object.freeze({ droppedEntries }),
    info: (event, details) => log("info", event, details),
    log,
    setContext(nextContext) {
      sharedContext = sanitizeLogValue(
        { ...sharedContext, ...(nextContext || {}) },
        limits,
      );
    },
    warn: (event, details) => log("warn", event, details),
  });
}
