import assert from "node:assert/strict";
import test from "node:test";
import { releaseDifferences, validateRelease } from "../src/instance/release.js";
import { composeArguments } from "../src/instance/service.js";
const legacy = {
  schemaVersion: 1,
  version: "0.7.1",
  deploymentRevision: 1,
  components: { "biaws-api": "0.9.0", "biaws-ui": "0.7.0", "biaws-monitor-executor": "0.1.0" },
};
test("schema 2 tracks deployed MCP while legacy snapshots stay readable", () => {
  const before = validateRelease(legacy);
  const after = validateRelease({
    ...legacy,
    schemaVersion: 2,
    components: { ...legacy.components, "biaws-mcp": "0.14.1" },
  });
  assert.deepEqual(
    releaseDifferences(before, after).map((d) => d.field),
    ["schemaVersion", "biaws-mcp"],
  );
  const changed = validateRelease({ ...after, components: { ...after.components, "biaws-mcp": "0.15.0" } });
  assert.deepEqual(releaseDifferences(after, changed), [
    { field: "biaws-mcp", current: "0.14.1", available: "0.15.0" },
  ]);
  assert.throws(() => validateRelease({ ...after, schemaVersion: 3 }));
  assert.throws(() => validateRelease({ ...legacy, components: after.components }));
  assert.throws(() => validateRelease({ ...after, components: legacy.components }));
});
test("optional MCP lifecycle retains overlay when disabled but starts profile only when enabled", () => {
  const instance = {
    name: "synthetic",
    envFile: "/tmp/synthetic.env",
    env: { BIAWS_MCP_CONFIGURED: "true", BIAWS_MCP_HTTP_ENABLED: "false" },
  };
  const context = { repositoryRoot: "/tmp/synthetic-root" };
  assert.ok(composeArguments(instance, context, "stop").includes("--profile"));
  assert.equal(composeArguments(instance, context, "start").includes("--profile"), false);
  instance.env.BIAWS_MCP_HTTP_ENABLED = "true";
  assert.ok(composeArguments(instance, context, "update").includes("--profile"));
});
