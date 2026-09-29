import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/api/httpClient.js";
test("MCP HTTP client retries only idempotent transient failures", async () => {
  const originalFetch = globalThis.fetch;
  const originalRetries = process.env.BIAWS_MCP_HTTP_RETRIES;
  process.env.BIAWS_MCP_HTTP_RETRIES = "1";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify(
        calls === 1
          ? { error: { code: "UNAVAILABLE", message: "Try again" } }
          : { ok: true },
      ),
      {
        status: calls === 1 ? 503 : 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  try {
    assert.deepEqual(await fetchJson("/api/issues"), { ok: true });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRetries === undefined)
      delete process.env.BIAWS_MCP_HTTP_RETRIES;
    else process.env.BIAWS_MCP_HTTP_RETRIES = originalRetries;
  }
});
