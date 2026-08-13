const SECRET_PATTERN =
  /\b(password|secret|token|credential|authorization|api[_-]?key)\b/iu;

function sanitize(value, key = "", depth = 0) {
  if (depth > 5) return "[TRUNCATED]";
  if (SECRET_PATTERN.test(key)) return "[REDACTED]";
  if (value instanceof Error) {
    return { name: value.name, message: sanitizeText(value.message) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, "", depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey, depth + 1),
      ]),
    );
  }
  return typeof value === "string" ? sanitizeText(value) : value;
}

function sanitizeText(value) {
  return String(value)
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/giu, "$1[REDACTED]")
    .replace(/\b(biaws_)[A-Za-z0-9_-]+/gu, "$1[REDACTED]")
    .replace(
      /\b(PASSWORD|SECRET|TOKEN|CREDENTIAL|AUTHORIZATION|API_KEY)=([^\s,;]+)/gu,
      "$1=[REDACTED]",
    );
}

export function createLogger({ now = () => new Date(), write } = {}) {
  const output =
    write ||
    ((level, entry) => {
      const line = JSON.stringify(entry);
      if (level === "error") console.error(line);
      else if (level === "warn") console.warn(line);
      else console.log(line);
    });
  function log(level, event, fields = {}) {
    output(level, {
      timestamp: now().toISOString(),
      level,
      service: "biaws-monitor-executor",
      event,
      ...sanitize(fields),
    });
  }
  return {
    info: (event, fields) => log("info", event, fields),
    warn: (event, fields) => log("warn", event, fields),
    error: (event, fields) => log("error", event, fields),
  };
}
