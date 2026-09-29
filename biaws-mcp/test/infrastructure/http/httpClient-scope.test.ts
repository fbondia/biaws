import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/httpClient.js";
test("MCP HTTP client sends the explicit workspace context", async () => {
  const originalFetch = globalThis.fetch;
  const originalWorkspaceId = process.env.BIAWS_WORKSPACE_ID;
  process.env.BIAWS_WORKSPACE_ID = "workspace-a";
  let receivedWorkspaceId: string | null = "";
  globalThis.fetch = async (url, options = {}) => {
    receivedWorkspaceId = new Headers(options.headers).get(
      "X-Biaws-Workspace-Id",
    );
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await fetchJson("/api/issues");
    assert.equal(receivedWorkspaceId, "workspace-a");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorkspaceId === undefined)
      delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = originalWorkspaceId;
  }
});
