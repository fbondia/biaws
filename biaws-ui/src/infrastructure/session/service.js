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

export function createSessionService({
  adapter,
  clearSensitiveState = () => {},
}) {
  if (!adapter) throw new TypeError("A session adapter is required");

  let state = initialState();
  let initializePromise;
  let operationVersion = 0;
  let initialized = false;
  let lastAuthenticated = false;
  let confirmedWorkspaceId = adapter.getWorkspaceId();
  const listeners = new Set();

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
    publish(
      lastAuthenticated
        ? {
            reason: reason || "Sua sessão expirou. Entre novamente.",
            status: SESSION_STATUS.EXPIRED,
          }
        : { status: SESSION_STATUS.ANONYMOUS },
    );
  }

  async function restoreForOperation(
    version,
    { preserveSelection = true } = {},
  ) {
    try {
      const actor = await adapter.restore();
      if (version !== operationVersion) return { applied: false, state };
      confirmedWorkspaceId = adapter.getWorkspaceId();
      return {
        applied: true,
        state: publish(
          actor
            ? { actor, status: SESSION_STATUS.AUTHENTICATED }
            : { status: SESSION_STATUS.ANONYMOUS },
        ),
      };
    } catch (error) {
      if (version !== operationVersion) return { applied: false, state };

      if (isWorkspaceForbidden(error) && adapter.getWorkspaceId()) {
        adapter.setWorkspaceId("");
        clear("workspace-forbidden");
        return restoreForOperation(version, { preserveSelection: false });
      }

      if (isUnauthorized(error)) {
        clear("expired");
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
      return {
        applied: true,
        state: publish({
          error: publicError(error),
          status: SESSION_STATUS.ERROR,
        }),
      };
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
      return restore();
    })().finally(() => {
      initializePromise = undefined;
    });

    return initializePromise;
  }

  async function signIn(credentials) {
    clear("sign-in");
    try {
      await adapter.signIn(credentials);
      lastAuthenticated = false;
      return await restore();
    } catch (error) {
      if (isUnauthorized(error)) {
        publish({ status: SESSION_STATUS.ANONYMOUS });
      }
      throw error;
    }
  }

  async function signOut() {
    operationVersion += 1;
    clear("sign-out");
    publish({ status: SESSION_STATUS.INITIALIZING });
    try {
      await adapter.signOut();
    } finally {
      operationVersion += 1;
      lastAuthenticated = false;
      adapter.setWorkspaceId("");
      confirmedWorkspaceId = "";
      publish({ status: SESSION_STATUS.ANONYMOUS });
    }
  }

  async function switchWorkspace(workspaceId) {
    const previousWorkspaceId = adapter.getWorkspaceId();
    const nextWorkspaceId = String(workspaceId || "").trim();
    if (nextWorkspaceId === previousWorkspaceId) return state;

    const version = operationVersion + 1;
    operationVersion = version;
    const rollbackWorkspaceId = confirmedWorkspaceId;
    clear("workspace-change");
    adapter.setWorkspaceId(nextWorkspaceId);
    publish({ status: SESSION_STATUS.INITIALIZING });
    const result = await restoreForOperation(version);

    if (!result.applied) return state;
    if (result.state.status === SESSION_STATUS.ERROR) {
      adapter.setWorkspaceId(rollbackWorkspaceId);
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
    signIn,
    signOut,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    switchWorkspace,
  });
}
