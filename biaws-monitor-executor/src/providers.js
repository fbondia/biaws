const RESULT_STATUSES = new Set([
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
  "stopped",
]);

export class ProviderNotRegisteredError extends Error {
  constructor(provider) {
    super(`Provider is not registered: ${provider}`);
    this.name = "ProviderNotRegisteredError";
    this.code = "PROVIDER_NOT_REGISTERED";
  }
}

export class ProviderRegistry {
  #providers = new Map();

  register(name, provider) {
    if (!name || typeof provider?.execute !== "function") {
      throw new TypeError("A provider name and execute function are required");
    }
    if (this.#providers.has(name)) {
      throw new Error(`Provider is already registered: ${name}`);
    }
    this.#providers.set(name, provider);
    return this;
  }

  async execute(monitor, options) {
    const provider = this.#providers.get(monitor.provider);
    if (!provider) throw new ProviderNotRegisteredError(monitor.provider);
    return provider.execute(monitor, options);
  }
}

export function normalizeProviderResult(
  result,
  monitor,
  observedAt = new Date(),
) {
  if (!result || !RESULT_STATUSES.has(result.status)) {
    throw new Error("Provider result must contain a supported status");
  }
  return {
    status: result.status,
    observedAt: result.observedAt || observedAt.toISOString(),
    source: result.source || `active-${monitor.provider}`,
    ...(result.message
      ? { message: String(result.message).slice(0, 4_000) }
      : {}),
    ...(result.metadata ? { metadata: result.metadata } : {}),
    ...(result.metadataProfile
      ? { metadataProfile: result.metadataProfile }
      : {}),
    ...(result.payload ? { payload: result.payload } : {}),
  };
}

export function providerFailureResult(error, monitor, observedAt = new Date()) {
  const timeout =
    error?.name === "TimeoutError" || error?.code === "PROVIDER_TIMEOUT";
  const unavailable = error?.code === "PROVIDER_NOT_REGISTERED";
  return {
    status: "unknown",
    observedAt: observedAt.toISOString(),
    source: `active-${monitor.provider}`,
    message: timeout
      ? "Provider execution timed out"
      : unavailable
        ? "Provider is not installed in this executor"
        : "Provider execution failed",
    metadata: {
      failure_kind: timeout
        ? "timeout"
        : unavailable
          ? "provider_unavailable"
          : "provider_failure",
    },
  };
}
