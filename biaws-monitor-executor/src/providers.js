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

export class ProviderConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderConfigurationError";
    this.code = code;
  }
}

export class ProviderRegistry {
  #providers = new Map();

  register(name, provider) {
    if (
      !name ||
      !provider?.configurationSchema ||
      typeof provider?.validateConfiguration !== "function" ||
      typeof provider?.execute !== "function" ||
      typeof provider?.normalizeEvidence !== "function"
    ) {
      throw new TypeError(
        "A provider name, configuration schema, validator, execute and evidence normalizer are required",
      );
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
    const configuration = provider.validateConfiguration(
      monitor.configuration || {},
    );
    const evidence = await provider.execute(
      { ...monitor, configuration },
      options,
    );
    return provider.normalizeEvidence(evidence);
  }

  schemas() {
    return Object.fromEntries(
      [...this.#providers].map(([name, provider]) => [
        name,
        provider.configurationSchema,
      ]),
    );
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
  const invalidConfiguration = error?.name === "ProviderConfigurationError";
  const templateFailure = error?.code === "TEMPLATE_EVALUATION_FAILED";
  return {
    status: "unknown",
    observedAt: observedAt.toISOString(),
    source: `active-${monitor.provider}`,
    message: timeout
      ? "Provider execution timed out"
      : templateFailure
        ? "Monitoring template evaluation failed"
        : unavailable
          ? "Provider is not installed in this executor"
          : invalidConfiguration
            ? "Provider configuration was refused by local policy"
            : "Provider execution failed",
    metadata: {
      failure_kind: timeout
        ? "timeout"
        : templateFailure
          ? "template_evaluation"
          : unavailable
            ? "provider_unavailable"
            : invalidConfiguration
              ? "configuration_refused"
              : "provider_failure",
      failure_stage: templateFailure ? "template" : "provider",
      ...(error?.code
        ? { diagnostic_code: String(error.code).slice(0, 100) }
        : {}),
    },
  };
}
