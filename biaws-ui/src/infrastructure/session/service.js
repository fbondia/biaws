export const SESSION_STATUS = Object.freeze({
  ANONYMOUS: "anonymous",
  AUTHENTICATED: "authenticated",
  ERROR: "error",
  EXPIRED: "expired",
  INITIALIZING: "initializing",
});

function initialState() {
  return Object.freeze({ status: SESSION_STATUS.INITIALIZING });
}

function publicError(error) {
  return Object.freeze({
    code: error?.code || "SESSION_ERROR",
    message: error?.message || "Não foi possível validar a sessão.",
    retryable: error?.statusCode !== 401,
  });
}

function isUnauthorized(error) {
  return error?.statusCode === 401;
}

function isWorkspaceForbidden(error) {
  return error?.code === "WORKSPACE_FORBIDDEN";
}

function signInCompletionEvent(nextState, durationMs) {
  const authenticated = nextState.status === SESSION_STATUS.AUTHENTICATED;
  const failed = nextState.status === SESSION_STATUS.ERROR;
  return {
    context: { durationMs },
    error: failed ? nextState.error : undefined,
    event: authenticated
      ? "session.sign_in.completed"
      : "session.sign_in.incomplete",
    level: authenticated ? "info" : failed ? "error" : "warn",
    message: authenticated
      ? "Sign-in completed"
      : "Sign-in did not establish an authenticated session",
  };
}

function signInFailureEvent(error, durationMs) {
  const unauthorized = isUnauthorized(error);
  return {
    context: { durationMs },
    error,
    event: unauthorized ? "session.sign_in.rejected" : "session.sign_in.failed",
    level: unauthorized ? "warn" : "error",
    message: unauthorized
      ? "Sign-in was rejected"
      : "Sign-in failed unexpectedly",
  };
}

function ensureReauthenticated(nextState) {
  if (nextState.status === SESSION_STATUS.AUTHENTICATED) return;
  const error = new Error(
    nextState.error?.message ||
      nextState.reason ||
      "Não foi possível restaurar a sessão. Tente novamente.",
  );
  error.code = nextState.error?.code || "REAUTHENTICATION_INCOMPLETE";
  throw error;
}

export function createSessionService({
  adapter,
  clearSensitiveState = () => {},
  eventSink = () => {},
  now = () => Date.now(),
}) {
  if (!adapter) throw new TypeError("A session adapter is required");

  let state = initialState();
  let initializePromise;
  let operationVersion = 0;
  let initialized = false;
  let lastAuthenticated = false;
  let confirmedWorkspaceId = adapter.getWorkspaceId();
  const listeners = new Set();

  function emit(event) {
    try {
      eventSink(event);
    } catch {
      // Optional diagnostics must never change a session transition.
    }
  }

  function publish(nextState) {
    state = Object.freeze(nextState);
    if (state.status === SESSION_STATUS.AUTHENTICATED) {
      lastAuthenticated = true;
    }
    for (const listener of listeners) listener(state);
    return state;
  }

  function clear(reason) {
    clearSensitiveState(reason);
  }

  function handleUnauthorized({ reason } = {}) {
    operationVersion += 1;
    clear("expired");
    if (lastAuthenticated) {
      emit({
        event: "session.expiration.detected",
        level: "info",
        message: "The authenticated session expired",
      });
    }
    publish(
      lastAuthenticated
        ? {
            reason: reason || "Sua sessão expirou. Entre novamente.",
            status: SESSION_STATUS.EXPIRED,
          }
        : { status: SESSION_STATUS.ANONYMOUS },
    );
  }

  function publishRestoredActor(actor, source) {
    confirmedWorkspaceId = adapter.getWorkspaceId();
    const nextState = publish(
      actor
        ? { actor, status: SESSION_STATUS.AUTHENTICATED }
        : { status: SESSION_STATUS.ANONYMOUS },
    );
    if (actor && ["initialize", "refresh"].includes(source)) {
      emit({
        context: { source },
        event: "session.restore.completed",
        level: "info",
        message: "Session identity was restored",
      });
    }
    return { applied: true, state: nextState };
  }

  async function handleRestoreFailure(
    error,
    version,
    { preserveSelection, source },
  ) {
    if (version !== operationVersion) return { applied: false, state };
    if (isWorkspaceForbidden(error) && adapter.getWorkspaceId()) {
      emit({
        context: { source },
        error,
        event: "session.workspace_selection.rejected",
        level: "warn",
        message: "The persisted workspace selection was rejected",
      });
      adapter.setWorkspaceId("");
      clear("workspace-forbidden");
      return restoreForOperation(version, {
        preserveSelection: false,
        source,
      });
    }
    if (isUnauthorized(error)) {
      clear("expired");
      if (lastAuthenticated) {
        emit({
          context: { source },
          event: "session.expiration.detected",
          level: "info",
          message: "The authenticated session expired during restoration",
        });
      }
      return {
        applied: true,
        state: publish(
          lastAuthenticated
            ? {
                reason: "Sua sessão expirou. Entre novamente.",
                status: SESSION_STATUS.EXPIRED,
              }
            : { status: SESSION_STATUS.ANONYMOUS },
        ),
      };
    }
    if (!preserveSelection) adapter.setWorkspaceId("");
    if (["initialize", "refresh"].includes(source)) {
      emit({
        context: { source },
        error,
        event: "session.restore.failed",
        level: "error",
        message: "Session restoration failed unexpectedly",
      });
    }
    return {
      applied: true,
      state: publish({
        error: publicError(error),
        status: SESSION_STATUS.ERROR,
      }),
    };
  }

  async function restoreForOperation(
    version,
    { preserveSelection = true, source = "refresh" } = {},
  ) {
    try {
      const actor = await adapter.restore();
      if (version !== operationVersion) return { applied: false, state };
      return publishRestoredActor(actor, source);
    } catch (error) {
      return handleRestoreFailure(error, version, {
        preserveSelection,
        source,
      });
    }
  }

  async function restore(options = {}) {
    const version = operationVersion + 1;
    operationVersion = version;
    publish({ status: SESSION_STATUS.INITIALIZING });
    const result = await restoreForOperation(version, options);
    return result.state;
  }

  async function initialize() {
    if (initialized) return state;
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      await adapter.initialize({ onUnauthorized: handleUnauthorized });
      initialized = true;
      return restore({ source: "initialize" });
    })().finally(() => {
      initializePromise = undefined;
    });

    return initializePromise;
  }

  async function signIn(credentials) {
    const startedAt = now();
    const stateBeforeSignIn = state;
    const reauthenticating =
      stateBeforeSignIn.status === SESSION_STATUS.EXPIRED;
    clear("sign-in");
    emit({
      event: "session.sign_in.started",
      level: "info",
      message: "Sign-in started",
    });
    try {
      await adapter.signIn(credentials);
      if (!reauthenticating) lastAuthenticated = false;
      const nextState = await restore({ source: "sign_in" });
      if (reauthenticating) {
        try {
          ensureReauthenticated(nextState);
        } catch (error) {
          publish(stateBeforeSignIn);
          throw error;
        }
      }
      emit(signInCompletionEvent(nextState, Math.max(0, now() - startedAt)));
      return nextState;
    } catch (error) {
      if (isUnauthorized(error)) {
        publish(
          reauthenticating
            ? stateBeforeSignIn
            : { status: SESSION_STATUS.ANONYMOUS },
        );
      }
      emit(signInFailureEvent(error, Math.max(0, now() - startedAt)));
      throw error;
    }
  }

  async function signOut() {
    const startedAt = now();
    operationVersion += 1;
    clear("sign-out");
    emit({
      event: "session.sign_out.started",
      level: "info",
      message: "Sign-out started",
    });
    publish({ status: SESSION_STATUS.INITIALIZING });
    try {
      await adapter.signOut();
    } catch (error) {
      emit({
        context: { durationMs: Math.max(0, now() - startedAt) },
        error,
        event: "session.sign_out.remote_failed",
        level: "error",
        message: "Remote sign-out failed; local session cleanup continued",
      });
      throw error;
    } finally {
      operationVersion += 1;
      lastAuthenticated = false;
      adapter.setWorkspaceId("");
      confirmedWorkspaceId = "";
      publish({ status: SESSION_STATUS.ANONYMOUS });
      emit({
        context: { durationMs: Math.max(0, now() - startedAt) },
        event: "session.sign_out.completed",
        level: "info",
        message: "Local sign-out completed",
      });
    }
  }

  async function switchWorkspace(workspaceId) {
    const startedAt = now();
    const previousWorkspaceId = adapter.getWorkspaceId();
    const nextWorkspaceId = String(workspaceId || "").trim();
    if (nextWorkspaceId === previousWorkspaceId) return state;

    const version = operationVersion + 1;
    operationVersion = version;
    const rollbackWorkspaceId = confirmedWorkspaceId;
    emit({
      context: {
        fromWorkspaceId: previousWorkspaceId || undefined,
        toWorkspaceId: nextWorkspaceId || undefined,
      },
      event: "session.workspace_switch.started",
      level: "info",
      message: "Workspace switch started",
    });
    clear("workspace-change");
    adapter.setWorkspaceId(nextWorkspaceId);
    publish({ status: SESSION_STATUS.INITIALIZING });
    const result = await restoreForOperation(version, {
      source: "workspace_switch",
    });

    if (!result.applied) {
      emit({
        context: {
          durationMs: Math.max(0, now() - startedAt),
          toWorkspaceId: nextWorkspaceId || undefined,
        },
        event: "session.workspace_switch.discarded",
        level: "warn",
        message: "An obsolete workspace switch result was discarded",
      });
      return state;
    }
    if (result.state.status === SESSION_STATUS.ERROR) {
      adapter.setWorkspaceId(rollbackWorkspaceId);
      emit({
        context: {
          durationMs: Math.max(0, now() - startedAt),
          rollbackWorkspaceId: rollbackWorkspaceId || undefined,
          toWorkspaceId: nextWorkspaceId || undefined,
        },
        error: result.state.error,
        event: "session.workspace_switch.failed",
        level: "error",
        message: "Workspace switch failed and selection was rolled back",
      });
    } else if (
      result.state.status === SESSION_STATUS.AUTHENTICATED &&
      adapter.getWorkspaceId() === nextWorkspaceId
    ) {
      emit({
        context: {
          durationMs: Math.max(0, now() - startedAt),
          workspaceId: nextWorkspaceId || undefined,
        },
        event: "session.workspace_switch.completed",
        level: "info",
        message: "Workspace switch completed",
      });
    } else {
      emit({
        context: {
          durationMs: Math.max(0, now() - startedAt),
          toWorkspaceId: nextWorkspaceId || undefined,
        },
        event: "session.workspace_switch.rejected",
        level: "warn",
        message: "Workspace switch did not establish the requested workspace",
      });
    }
    return result.state;
  }

  async function dispose() {
    operationVersion += 1;
    initialized = false;
    initializePromise = undefined;
    await adapter.dispose?.();
    listeners.clear();
    state = initialState();
    lastAuthenticated = false;
    confirmedWorkspaceId = adapter.getWorkspaceId();
  }

  return Object.freeze({
    dispose,
    getState: () => state,
    initialize,
    refresh: restore,
    setEventSink(nextEventSink) {
      eventSink =
        typeof nextEventSink === "function" ? nextEventSink : () => {};
    },
    signIn,
    signOut,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    switchWorkspace,
  });
}
