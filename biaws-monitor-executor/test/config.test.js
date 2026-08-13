import assert from "node:assert/strict";
import test from "node:test";

import { getExecutorConfig } from "../src/config.js";

test("enabled executor requires an isolated API credential and workspace", () => {
  assert.throws(
    () => getExecutorConfig({ BIAWS_MONITOR_EXECUTOR_ENABLED: "true" }),
    /API_KEY.*WORKSPACE_ID/u,
  );
  const config = getExecutorConfig({
    BIAWS_MONITOR_EXECUTOR_ENABLED: "true",
    BIAWS_MONITOR_EXECUTOR_API_KEY: "test-key",
    BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID: "workspace-test",
    BIAWS_MONITOR_EXECUTOR_CONCURRENCY: "3",
  });
  assert.equal(config.enabled, true);
  assert.equal(config.concurrency, 3);
});

test("disabled executor can expose health without API credentials", () => {
  const config = getExecutorConfig({
    BIAWS_MONITOR_EXECUTOR_ENABLED: "false",
    BIAWS_MONITOR_EXECUTOR_HEALTH_PORT: "0",
  });
  assert.equal(config.enabled, false);
  assert.equal(config.healthPort, 0);
});
