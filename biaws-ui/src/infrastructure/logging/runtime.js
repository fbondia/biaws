import { defineLoggingAdapter } from "./contract.js";
import { createConsoleTransport } from "./consoleTransport.js";
import { createLogger } from "./service.js";

const development = Boolean(import.meta.env?.DEV);

export const defaultLogger = createLogger({
  transports: development ? [createConsoleTransport()] : [],
});

export function connectGlobalErrorLogging({
  logger = defaultLogger,
  target = typeof window === "undefined" ? null : window,
} = {}) {
  if (!target?.addEventListener) return () => {};

  const reportError = (event) => {
    try {
      logger.error("application.error.unhandled", {
        context: {
          columnNumber: event?.colno,
          lineNumber: event?.lineno,
        },
        error: event?.error || new Error(event?.message || "Unhandled error"),
        message: "An unhandled browser error reached the global boundary",
      });
    } catch {
      // A global reporter must never generate another escaped error.
    }
  };
  const reportRejection = (event) => {
    try {
      logger.error("application.rejection.unhandled", {
        error: event?.reason || new Error("Unhandled promise rejection"),
        message: "An unhandled promise rejection reached the global boundary",
      });
    } catch {
      // A global reporter must never generate another escaped rejection.
    }
  };
  target.addEventListener("error", reportError);
  target.addEventListener("unhandledrejection", reportRejection);

  return () => {
    target.removeEventListener("error", reportError);
    target.removeEventListener("unhandledrejection", reportRejection);
  };
}

let disconnectGlobalErrors;

export const defaultLoggingBootstrapAdapter = defineLoggingAdapter({
  async dispose() {
    disconnectGlobalErrors?.();
    disconnectGlobalErrors = undefined;
    await defaultLogger.flush();
  },
  initialize() {
    disconnectGlobalErrors?.();
    disconnectGlobalErrors = connectGlobalErrorLogging();
    return defaultLogger;
  },
  log: defaultLogger.log,
});
