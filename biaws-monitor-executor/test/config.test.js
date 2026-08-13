import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
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
  assert.deepEqual(config.rest.allowedHosts, []);
  assert.deepEqual(config.rest.allowedMethods, ["GET", "HEAD"]);
  assert.equal(config.rest.allowPrivateAddresses, false);
  assert.deepEqual(config.shell.scripts, {});
  assert.deepEqual(config.referenceFiles, {});
  assert.equal(config.referenceFileRoot, "/run/secrets");
  assert.equal(config.providerEvidenceMaxBytes, 8_000);
});

test("disabled executor can expose health without API credentials", () => {
  const config = getExecutorConfig({
    BIAWS_MONITOR_EXECUTOR_ENABLED: "false",
    BIAWS_MONITOR_EXECUTOR_HEALTH_PORT: "0",
  });
  assert.equal(config.enabled, false);
  assert.equal(config.healthPort, 0);
});

test("executor reads its API credential from a mounted file", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "biaws-executor-key-"));
  const keyFile = path.join(directory, "api-key");
  writeFileSync(keyFile, "file-backed-key\n", { mode: 0o600 });
  const config = getExecutorConfig({
    BIAWS_MONITOR_EXECUTOR_ENABLED: "true",
    BIAWS_MONITOR_EXECUTOR_API_KEY_FILE: keyFile,
    BIAWS_MONITOR_EXECUTOR_WORKSPACE_ID: "workspace-test",
  });

  assert.equal(config.apiKey, "file-backed-key");
});
