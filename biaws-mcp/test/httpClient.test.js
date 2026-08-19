import assert from "node:assert/strict";
import test from "node:test";

import { fetchJson } from "../src/httpClient.js";
import { runWithRequestContext } from "../src/requestContext.js";

test("MCP HTTP client sends the explicit workspace context", async () => {
  const originalFetch = globalThis.fetch;
  const originalWorkspaceId = process.env.BIAWS_WORKSPACE_ID;
  process.env.BIAWS_WORKSPACE_ID = "workspace-a";
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
      delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = originalWorkspaceId;
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

test("MCP HTTP client preserves validation and authorization details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Payload is invalid",
          requestId: "request-123",
          requiredPermissions: ["issues.write"],
          fields: [
            {
              path: "applicationId",
              code: "required",
              message: "applicationId is required",
            },
          ],
          retryable: false,
        },
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) =>
        error.requestId === "request-123" &&
        error.requiredPermissions[0] === "issues.write" &&
        error.fields[0].path === "applicationId" &&
        error.retryable === false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MCP HTTP client times out stalled responses", async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = process.env.BIAWS_MCP_HTTP_TIMEOUT_MS;
  process.env.BIAWS_MCP_HTTP_TIMEOUT_MS = "20";
  globalThis.fetch = async (url, { signal }) =>
    new Promise((_, reject) => {
      // AbortSignal.timeout uses an unreferenced timer in Node 22. A real
      // pending request keeps the event loop alive, so the stub must too.
      const pendingRequest = setTimeout(
        () => reject(new Error("Expected the stalled request to be aborted")),
        1_000,
      );
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(pendingRequest);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) =>
        error.code === "UPSTREAM_TIMEOUT" &&
        error.statusCode === 504 &&
        error.retryable === true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTimeout === undefined)
      delete process.env.BIAWS_MCP_HTTP_TIMEOUT_MS;
    else process.env.BIAWS_MCP_HTTP_TIMEOUT_MS = originalTimeout;
  }
});

test("MCP HTTP client distinguishes caller cancellation from timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  const controller = new AbortController();
  try {
    const request = runWithRequestContext({ signal: controller.signal }, () =>
      fetchJson("/api/issues"),
    );
    controller.abort();
    await assert.rejects(
      () => request,
      (error) =>
        error.code === "REQUEST_CANCELLED" &&
        error.statusCode === 499 &&
        error.retryable === false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
