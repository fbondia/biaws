import assert from "node:assert/strict";
import test from "node:test";
import {
  errorInfo,
  fieldErrors,
  recordEvents,
  required,
  type LogEvent,
} from "./helpers/types.js";

import { fetchJson } from "../src/httpClient.js";
import { runWithRequestContext } from "../src/requestContext.js";

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
      (error) =>
        errorInfo(error).code === "FORBIDDEN" &&
        errorInfo(error).statusCode === 403,
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
  ] as const;
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
          errorInfo(error).code === code &&
          errorInfo(error).statusCode === status &&
          errorInfo(error).message === `Error ${status}`,
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
        errorInfo(error).requestId === "request-123" &&
        JSON.stringify(errorInfo(error).requiredPermissions) ===
          JSON.stringify(["issues.write"]) &&
        "issues.write" === "issues.write" &&
        fieldErrors(error)[0].path === "applicationId" &&
        errorInfo(error).retryable === false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MCP HTTP client times out stalled responses", async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = process.env.BIAWS_MCP_HTTP_TIMEOUT_MS;
  process.env.BIAWS_MCP_HTTP_TIMEOUT_MS = "20";
  globalThis.fetch = async (url, options) =>
    new Promise((_, reject) => {
      // AbortSignal.timeout uses an unreferenced timer in Node 22. A real
      // pending request keeps the event loop alive, so the stub must too.
      const pendingRequest = setTimeout(
        () => reject(new Error("Expected the stalled request to be aborted")),
        1_000,
      );
      required(options?.signal).addEventListener(
        "abort",
        () => {
          clearTimeout(pendingRequest);
          reject(required(options?.signal).reason);
        },
        { once: true },
      );
    });
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) =>
        errorInfo(error).code === "UPSTREAM_TIMEOUT" &&
        errorInfo(error).statusCode === 504 &&
        errorInfo(error).retryable === true,
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
  globalThis.fetch = async (url, options) =>
    new Promise((resolve, reject) => {
      required(options?.signal).addEventListener(
        "abort",
        () => reject(required(options?.signal).reason),
        {
          once: true,
        },
      );
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
        errorInfo(error).code === "REQUEST_CANCELLED" &&
        errorInfo(error).statusCode === 499 &&
        errorInfo(error).retryable === false,
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

test("MCP HTTP retries emit sanitized correlated diagnostics", async () => {
  const originalFetch = globalThis.fetch;
  const originalRetries = process.env.BIAWS_MCP_HTTP_RETRIES;
  const originalUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_MCP_HTTP_RETRIES = "1";
  process.env.BIAWS_API_URL = "https://api.example.test";
  const events: LogEvent[] = [];
  const logger = recordEvents(events);
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ ok: calls > 1 }), {
      status: calls === 1 ? 503 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await runWithRequestContext(
      {
        signal: new AbortController().signal,
        logger,
        requestId: "request-1",
        tool: "demands_list_tasks",
      },
      () => fetchJson("/api/requests/id/tasks", { status: "secret-value" }),
    );
    assert.deepEqual(
      events.map(({ event }) => event),
      [
        "mcp_http_attempt_started",
        "mcp_http_attempt_failed",
        "mcp_http_retry_scheduled",
        "mcp_http_attempt_started",
        "mcp_http_attempt_completed",
      ],
    );
    assert.equal(events[1].fields.requestId, "request-1");
    assert.equal(events[1].fields.origin, "https://api.example.test");
    assert.doesNotMatch(
      JSON.stringify(events),
      /secret-value|\/api\/requests/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRetries === undefined)
      delete process.env.BIAWS_MCP_HTTP_RETRIES;
    else process.env.BIAWS_MCP_HTTP_RETRIES = originalRetries;
    if (originalUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalUrl;
  }
});

for (const payload of [
  { items: [{ id: 42 }] },
  { items: "invalid" },
  { meta: { total: "10" } },
]) {
  test(`malformed upstream data fails without retries: ${JSON.stringify(payload)}`, async (t) => {
    const previous = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json(payload);
    };
    t.after(() => {
      globalThis.fetch = previous;
    });
    await assert.rejects(
      fetchJson("/api/issues"),
      (error) =>
        errorInfo(error).code === "INVALID_UPSTREAM_PAYLOAD" &&
        errorInfo(error).statusCode === 502 &&
        errorInfo(error).retryable === false,
    );
    assert.equal(calls, 1);
  });
}
