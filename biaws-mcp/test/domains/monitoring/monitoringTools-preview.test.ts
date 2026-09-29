import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { withHttpClient } from "./monitoringTools.fixtures.js";
test(
  "active monitor tools use explicit runtime scope and omit path ids from payloads",
  withHttpClient(async (calls) => {
    await dispatchTool("runtime_active_monitors_create", {
      runtimeReference: "runtime-1",
      name: "Health REST",
      provider: "rest",
      enabled: false,
      intervalSeconds: 60,
      timeoutSeconds: 15,
      configuration: { method: "GET", url: "https://status.example.test" },
      templateRef: { id: "health", version: "2" },
    });
    await dispatchTool("runtime_active_monitors_update", {
      runtimeReference: "runtime-1",
      monitorId: "monitor/1",
      enabled: true,
    });
    await dispatchTool("runtime_active_monitors_archive", {
      runtimeReference: "runtime-1",
      monitorId: "monitor/1",
    });

    assert.deepEqual(
      calls.map(({ options }) => options.method),
      ["POST", "PATCH", "DELETE"],
    );
    assert.deepEqual(
      calls.map(({ url }) => new URL(url).pathname),
      [
        "/api/monitoring/runtimes/runtime-1/active-monitors",
        "/api/monitoring/runtimes/runtime-1/active-monitors/monitor%2F1",
        "/api/monitoring/runtimes/runtime-1/active-monitors/monitor%2F1",
      ],
    );
    const createPayload = JSON.parse(String(calls[0].options.body));
    assert.equal(Object.hasOwn(createPayload, "runtimeReference"), false);
    assert.equal(createPayload.enabled, false);
    assert.deepEqual(createPayload.templateRef, {
      id: "health",
      version: "2",
    });
    assert.deepEqual(JSON.parse(String(calls[1].options.body)), {
      enabled: true,
    });
  }),
);
