import assert from "node:assert/strict";
import test from "node:test";
import { getMcpOAuthConfig, createMcpOAuthPlugins } from "../../src/auth/oauthProvider.js";

test("MCP OAuth is disabled by default and does not require a public URL", () => {
  assert.equal(getMcpOAuthConfig("http://api:3100", {}).enabled, false);
});
test("MCP OAuth binds issuer and resource to configured public URLs", () => {
  assert.deepEqual(
    getMcpOAuthConfig("https://biaws.example.test", {
      BIAWS_MCP_HTTP_ENABLED: "true",
    }),
    {
      enabled: true,
      issuer: "https://biaws.example.test/api/auth",
      resource: "https://biaws.example.test/mcp",
    },
  );
});
test("MCP OAuth rejects unsafe URLs and ambiguous enable flags", () => {
  for (const url of [
    "http://remote.example.test/mcp",
    "https://u:p@example.test/mcp",
    "https://example.test/mcp?token=x",
    "https://example.test/mcp#x",
  ]) {
    assert.throws(() =>
      getMcpOAuthConfig("https://example.test", {
        BIAWS_MCP_HTTP_ENABLED: "true",
        BIAWS_MCP_PUBLIC_URL: url,
      }),
    );
  }
  assert.throws(() =>
    getMcpOAuthConfig("https://example.test", {
      BIAWS_MCP_HTTP_ENABLED: "yes",
    }),
  );
});
test("MCP OAuth uses one provider, persistent JWT keys and explicit CIMD", () => {
  assert.deepEqual(
    createMcpOAuthPlugins("https://example.test/mcp").map((p) => p.id),
    ["jwt", "oauth-provider", "cimd"],
  );
});
