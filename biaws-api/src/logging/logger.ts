export interface SerializedError {
  message: string;
  name?: string;
  code?: string | number;
  stack?: string;
  cause?: SerializedError;
}
export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;
export interface LogEntry extends LogFields {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
}
export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}
interface LoggerOptions {
  now?: () => Date;
  write?: (level: LogLevel, entry: LogEntry) => void;
}
const SERVICE_NAME = "biaws-api";

export function redactLogText(value: unknown) {
  return String(value)
    .replaceAll(/\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/giu, "$1[REDACTED]@")
    .replaceAll(/\b(Bearer\s+)[a-z0-9._~+/=-]+/giu, "$1[REDACTED]")
    .replaceAll(/\b(biaws_)[A-Za-z0-9_-]+/gu, "$1[REDACTED]")
    .replaceAll(
      /(["']?(?:password|passwd|pwd|secret(?:value)?|token|credential|authorization)["']?\s*[:=]\s*["'])[^"']*(["'])/giu,
      "$1[REDACTED]$2",
    )
    .replaceAll(/(["']?(?:client[_-]?secret|api[_-]?key)["']?\s*[:=]\s*["'])[^"']*(["'])/giu, "$1[REDACTED]$2")
    .replaceAll(/(["']?(?:private[_-]?key|connection[_-]?string)["']?\s*[:=]\s*["'])[^"']*(["'])/giu, "$1[REDACTED]$2")
    .replaceAll(
      /\b(PASSWORD|SECRET|CLIENT_SECRET|TOKEN|CREDENTIAL|AUTHORIZATION|API_KEY|PRIVATE_KEY|CONNECTION_STRING)=([^\s,;]+)/gu,
      "$1=[REDACTED]",
    );
}

function serializeCause(cause: unknown, depth: number): SerializedError | undefined {
  if (!cause || depth > 2) return undefined;
  if (cause instanceof Error) return serializeError(cause, depth);
  return { message: redactLogText(cause) };
}

export function serializeError(error: unknown, depth = 0): SerializedError {
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
  write = (level: LogLevel, entry: LogEntry) => {
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  },
}: LoggerOptions = {}): Logger {
  function log(level: LogLevel, event: string, fields: LogFields = {}) {
    write(level, {
      timestamp: now().toISOString(),
      level,
      service: SERVICE_NAME,
      event,
      ...fields,
    });
  }

  return {
    info(event: string, fields?: LogFields) {
      log("info", event, fields);
    },
    warn(event: string, fields?: LogFields) {
      log("warn", event, fields);
    },
    error(event: string, fields?: LogFields) {
      log("error", event, fields);
    },
  };
}

export const apiLogger = createLogger();
