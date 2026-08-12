import { defineSessionAdapter } from "./contract.js";
import { createHttpSessionAdapter } from "./httpAdapter.js";
import { clearSessionScopedState } from "./scopedState.js";
import { createSessionService } from "./service.js";

export const defaultSessionService = createSessionService({
  adapter: createHttpSessionAdapter(),
  clearSensitiveState: clearSessionScopedState,
});

let bootstrapConsumers = 0;
let disconnectLoggingContext;

export function loggingContextFromSessionState(state) {
  if (state?.status !== "authenticated") return null;
  return {
    actorId: state.actor?.userId || state.actor?.id || undefined,
    workspaceId: state.actor?.workspaceId || undefined,
  };
}

export function connectSessionLoggingContext({ logger, sessionService }) {
  if (!logger?.setContext || !logger?.clearContext || !sessionService) {
    return () => {};
  }
  const synchronize = (state) => {
    try {
      const context = loggingContextFromSessionState(state);
      if (context) logger.setContext(context);
      else logger.clearContext(["actorId", "workspaceId"]);
    } catch {
      // Optional logging enrichment must not alter session transitions.
    }
  };
  sessionService.setEventSink?.(({ context, error, event, level, message }) => {
    try {
      logger[level]?.(event, { context, error, message });
    } catch {
      // Optional logging integration must not alter session transitions.
    }
  });
  synchronize(sessionService.getState());
  const unsubscribe = sessionService.subscribe(synchronize);
  return () => {
    sessionService.setEventSink?.();
    try {
      logger.clearContext(["actorId", "workspaceId"]);
    } catch {
      // Logging cleanup is best effort and must not block session disposal.
    }
    try {
      unsubscribe();
    } catch {
      // Optional logging integration must not block session disposal.
    }
  };
}

function connectLoggingContext(logger) {
  disconnectLoggingContext?.();
  disconnectLoggingContext = connectSessionLoggingContext({
    logger,
    sessionService: defaultSessionService,
  });
}

function disconnectFromLoggingContext() {
  disconnectLoggingContext?.();
  disconnectLoggingContext = undefined;
}

export const defaultSessionBootstrapAdapter = defineSessionAdapter({
  async dispose() {
    bootstrapConsumers = Math.max(0, bootstrapConsumers - 1);
    if (bootstrapConsumers === 0) {
      disconnectFromLoggingContext();
      await defaultSessionService.dispose();
    }
  },
  async initialize({ dependencies } = {}) {
    bootstrapConsumers += 1;
    connectLoggingContext(dependencies?.logging);
    try {
      await defaultSessionService.initialize();
      return defaultSessionService;
    } catch (error) {
      bootstrapConsumers = Math.max(0, bootstrapConsumers - 1);
      if (bootstrapConsumers === 0) disconnectFromLoggingContext();
      throw error;
    }
  },
});
