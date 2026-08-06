const SERVICE_NAME = "biaws-api";

export function redactLogText(value) {
  return String(value)
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/giu,
      "$1[REDACTED]@",
    )
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/giu, "$1[REDACTED]")
    .replace(/\b(biaws_)[A-Za-z0-9_-]+/gu, "$1[REDACTED]")
    .replace(
      /(["']?(?:password|passwd|pwd|secret(?:value)?|client[_-]?secret|token|credential|authorization|api[_-]?key|private[_-]?key|connection[_-]?string)["']?\s*[:=]\s*["'])[^"']*(["'])/giu,
      "$1[REDACTED]$2",
    )
    .replace(
      /\b(PASSWORD|SECRET|CLIENT_SECRET|TOKEN|CREDENTIAL|AUTHORIZATION|API_KEY|PRIVATE_KEY|CONNECTION_STRING)=([^\s,;]+)/gu,
      "$1=[REDACTED]",
    );
}

function serializeCause(cause, depth) {
  if (!cause || depth > 2) return undefined;
  if (cause instanceof Error) return serializeError(cause, depth);
  return { message: redactLogText(cause) };
}

export function serializeError(error, depth = 0) {
  if (!(error instanceof Error)) {
    return { message: redactLogText(error || "Unknown error") };
  }

  return {
    name: error.name,
    message: redactLogText(error.message),
    ...(error.code === undefined ? {} : { code: error.code }),
    ...(error.stack ? { stack: redactLogText(error.stack) } : {}),
    ...(error.cause ? { cause: serializeCause(error.cause, depth + 1) } : {}),
  };
}

export function createLogger({
  now = () => new Date(),
  write = (level, entry) => {
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  },
} = {}) {
  function log(level, event, fields = {}) {
    write(level, {
      timestamp: now().toISOString(),
      level,
      service: SERVICE_NAME,
      event,
      ...fields,
    });
  }

  return {
    info(event, fields) {
      log("info", event, fields);
    },
    warn(event, fields) {
      log("warn", event, fields);
    },
    error(event, fields) {
      log("error", event, fields);
    },
  };
}

export const apiLogger = createLogger();
