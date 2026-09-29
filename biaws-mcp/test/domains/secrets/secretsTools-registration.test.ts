import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
test("secrets_register sends metadata to the registration endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  const originalApiKey = process.env.BIAWS_API_KEY;
  const calls: { url: string; options: RequestInit }[] = [];
  process.env.BIAWS_API_URL = "http://127.0.0.1:3199";
  process.env.BIAWS_API_KEY = "biaws_test_key";
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options || {} });
    return new Response(JSON.stringify({ secret: { id: "secret-a" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await dispatchTool("secrets_register", {
      identifier: "github-token-production",
      name: "GitHub token",
      type: "token",
      environment: "production",
      applicationId: "application-a",
      contentKind: "text",
    });
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/api/secrets/registrations");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(new Headers(calls[0].options.headers).get("Authorization"), "Bearer biaws_test_key");
    assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
      identifier: "github-token-production",
      name: "GitHub token",
      type: "token",
      environment: "production",
      applicationId: "application-a",
      contentKind: "text",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.BIAWS_API_KEY;
    else process.env.BIAWS_API_KEY = originalApiKey;
  }
});
