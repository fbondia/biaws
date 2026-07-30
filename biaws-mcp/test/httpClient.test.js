import assert from "node:assert/strict";
import test from "node:test";

import { fetchJson } from "../src/httpClient.js";

test("MCP HTTP client sends the explicit workspace context", async () => {
  const originalFetch = globalThis.fetch;
  const originalWorkspaceId = process.env.ISSUE_WORKSPACE_ID;
  process.env.ISSUE_WORKSPACE_ID = "workspace-a";
  let receivedWorkspaceId = "";
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
      delete process.env.ISSUE_WORKSPACE_ID;
    else process.env.ISSUE_WORKSPACE_ID = originalWorkspaceId;
  }
});

test("MCP HTTP client distinguishes forbidden responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ error: { code: "FORBIDDEN", message: "Denied" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) => error.code === "FORBIDDEN" && error.statusCode === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MCP HTTP client preserves structured API errors", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "APPLICATION_NOT_FOUND"],
    [409, "APPLICATION_IN_USE"],
    [422, "INVALID_CATALOG_PAYLOAD"],
  ];
  try {
    for (const [status, code] of cases) {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({ error: { code, message: `Error ${status}` } }),
          { status, headers: { "Content-Type": "application/json" } },
        );
      await assert.rejects(
        () => fetchJson("/api/catalog/applications/example"),
        (error) =>
          error.code === code &&
          error.statusCode === status &&
          error.message === `Error ${status}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
