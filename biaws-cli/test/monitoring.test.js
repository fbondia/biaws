import assert from "node:assert/strict";
import test from "node:test";

import { runMonitoringCommand } from "../src/commands/monitoring.js";

function captureConsole(callback) {
  const messages = [];
  const original = console.log;
  console.log = (...args) => messages.push(args.join(" "));
  return Promise.resolve()
    .then(callback)
    .then((result) => ({ messages, result }))
    .finally(() => {
      console.log = original;
    });
}

test("signal envia templateRef e payload sem exigir status calculado pelo cliente", async () => {
  let received;
  const api = {
    monitoring: {
      signal: async (runtime, payload) => {
        received = { runtime, payload };
        return {
          created: true,
          signal: {
            runtimeId: "runtime-1",
            status: "healthy",
            source: "probe",
          },
        };
      },
    },
  };
  await captureConsole(() =>
    runMonitoringCommand(api, "signal", ["app.api.prod.runtime"], {
      source: "probe",
      template: "sgmp-health",
      "template-version": "1",
      payload: '{"service_up":true}',
    }),
  );
  assert.deepEqual(received, {
    runtime: "app.api.prod.runtime",
    payload: {
      source: "probe",
      templateRef: { id: "sgmp-health", version: "1" },
      metadata: {},
      payload: { service_up: true },
    },
  });
});

test("describe consulta contrato versionado", async () => {
  let received;
  const api = {
    monitoring: {
      describeTemplate: async (id, version) => {
        received = { id, version };
        return {
          contract: {
            name: "Saúde",
            status: "active",
            templateRef: { id, version },
            input: { mediaType: "application/json", sample: { up: true } },
            transformation: { language: "jsonata" },
            output: { status: { type: "string" } },
          },
        };
      },
    },
  };
  const { messages } = await captureConsole(() =>
    runMonitoringCommand(api, "describe", [], {
      template: "health",
      "template-version": "2",
    }),
  );
  assert.deepEqual(received, { id: "health", version: "2" });
  assert.match(messages.join("\n"), /Saúde v2/);
});

test("validate envia amostra sem registrar sinal", async () => {
  let received;
  const api = {
    monitoring: {
      validateTemplate: async (id, version, sample) => {
        received = { id, version, sample };
        return { validation: { result: { status: "healthy", message: "ok" } } };
      },
    },
  };
  const { messages } = await captureConsole(() =>
    runMonitoringCommand(api, "validate", [], {
      template: "health",
      "template-version": "1",
      payload: '{"up":true}',
    }),
  );
  assert.deepEqual(received, {
    id: "health",
    version: "1",
    sample: { up: true },
  });
  assert.match(messages.join("\n"), /Payload válido: healthy/);
});
