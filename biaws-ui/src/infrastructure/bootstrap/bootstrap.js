export const BOOTSTRAP_STATUS = Object.freeze({
  INITIALIZING: "initializing",
  READY: "ready",
  DEGRADED: "degraded",
  FAILED: "failed",
});

export const CAPABILITY_STATUS = Object.freeze({
  PENDING: "pending",
  INITIALIZING: "initializing",
  READY: "ready",
  FAILED: "failed",
  BLOCKED: "blocked",
});

function describeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: String(error),
    name: "Error",
  };
}

function validateCapabilities(capabilities) {
  const ids = new Set();

  for (const capability of capabilities) {
    if (!capability?.id || typeof capability.initialize !== "function") {
      throw new TypeError(
        "Bootstrap capabilities require an id and an initialize function",
      );
    }
    if (ids.has(capability.id)) {
      throw new Error(`Duplicate bootstrap capability: ${capability.id}`);
    }
    ids.add(capability.id);
  }

  for (const capability of capabilities) {
    for (const dependencyId of capability.dependsOn || []) {
      if (!ids.has(dependencyId)) {
        throw new Error(
          `Unknown bootstrap dependency ${dependencyId} for ${capability.id}`,
        );
      }
    }
  }
}

function initialCapabilityState(capability) {
  return {
    critical: Boolean(capability.critical),
    error: null,
    id: capability.id,
    status: CAPABILITY_STATUS.PENDING,
  };
}

export function createInitialBootstrapState(capabilities) {
  validateCapabilities(capabilities);
  return {
    capabilities: capabilities.map(initialCapabilityState),
    status: BOOTSTRAP_STATUS.INITIALIZING,
  };
}

function replaceCapability(state, id, update) {
  return {
    ...state,
    capabilities: state.capabilities.map((capability) =>
      capability.id === id ? { ...capability, ...update } : capability,
    ),
  };
}

function finalStatus(capabilities) {
  const failures = capabilities.filter((capability) =>
    [CAPABILITY_STATUS.FAILED, CAPABILITY_STATUS.BLOCKED].includes(
      capability.status,
    ),
  );

  if (failures.some((capability) => capability.critical)) {
    return BOOTSTRAP_STATUS.FAILED;
  }
  if (failures.length) return BOOTSTRAP_STATUS.DEGRADED;
  return BOOTSTRAP_STATUS.READY;
}

async function disposeInitializedCapabilities(initialized) {
  const failures = [];

  for (const { capability, value } of [...initialized].reverse()) {
    try {
      await capability.dispose?.(value);
    } catch (error) {
      failures.push(
        new Error(`Failed to dispose capability ${capability.id}`, {
          cause: error,
        }),
      );
    }
  }

  if (failures.length) {
    throw new AggregateError(
      failures,
      "Failed to dispose one or more infrastructure capabilities",
    );
  }
}

export async function disposeInfrastructureSafely(
  bootstrap,
  onDisposeError = () => {},
) {
  if (!bootstrap) return;

  try {
    await bootstrap.dispose();
  } catch (error) {
    onDisposeError(error);
  }
}

/**
 * Initializes capabilities in declaration order while containing individual
 * failures. Only hard dependencies in `dependsOn` block another capability.
 */
export async function initializeInfrastructure({
  capabilities,
  onStateChange = () => {},
}) {
  let state = createInitialBootstrapState(capabilities);
  const initialized = [];
  const values = new Map();
  onStateChange(state);

  for (const capability of capabilities) {
    const unavailableDependency = (capability.dependsOn || []).find(
      (dependencyId) =>
        state.capabilities.find(({ id }) => id === dependencyId)?.status !==
        CAPABILITY_STATUS.READY,
    );

    if (unavailableDependency) {
      state = replaceCapability(state, capability.id, {
        error: {
          message: `Dependency ${unavailableDependency} is unavailable`,
          name: "BootstrapDependencyError",
        },
        status: CAPABILITY_STATUS.BLOCKED,
      });
      onStateChange(state);
      continue;
    }

    state = replaceCapability(state, capability.id, {
      status: CAPABILITY_STATUS.INITIALIZING,
    });
    onStateChange(state);

    try {
      const value = await capability.initialize({
        dependencies: Object.fromEntries(values),
      });
      values.set(capability.id, value);
      initialized.push({ capability, value });
      state = replaceCapability(state, capability.id, {
        status: CAPABILITY_STATUS.READY,
      });
    } catch (error) {
      state = replaceCapability(state, capability.id, {
        error: describeError(error),
        status: CAPABILITY_STATUS.FAILED,
      });
    }
    onStateChange(state);
  }

  state = {
    ...state,
    status: finalStatus(state.capabilities),
  };
  onStateChange(state);

  let disposePromise;

  return {
    state,
    dispose() {
      disposePromise ??= disposeInitializedCapabilities(initialized);
      return disposePromise;
    },
  };
}
