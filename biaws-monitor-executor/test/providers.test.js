import assert from "node:assert/strict";
import test from "node:test";

import { providerFailureResult, ProviderRegistry } from "../src/providers.js";

test("provider registry exposes schemas and validates before execution", async () => {
  let received;
  const provider = {
    configurationSchema: { type: "object", required: ["value"] },
    validateConfiguration(configuration) {
      return { value: String(configuration.value).toUpperCase() };
    },
    normalizeEvidence: (evidence) => evidence,
    async execute(monitor) {
      received = monitor.configuration;
      return { status: "healthy" };
    },
  };
  const registry = new ProviderRegistry().register("custom", provider);
  await registry.execute({
    provider: "custom",
    configuration: { value: "ok" },
  });
  assert.deepEqual(received, { value: "OK" });
  assert.deepEqual(registry.schemas().custom, provider.configurationSchema);
});

test("failure results distinguish provider and template failures", () => {
  const monitor = { provider: "rest" };
  assert.equal(
    providerFailureResult(
      Object.assign(new Error("invalid"), {
        name: "ProviderConfigurationError",
        code: "REST_HOST_NOT_ALLOWED",
      }),
      monitor,
    ).metadata.failure_stage,
    "provider",
  );
  assert.equal(
    providerFailureResult(
      Object.assign(new Error("template"), {
        code: "TEMPLATE_EVALUATION_FAILED",
      }),
      monitor,
    ).metadata.failure_stage,
    "template",
  );
});
