import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/api/httpClient.js";
import { runWithRequestContext } from "../../../src/runtime/requestContext.js";
import { recordEvents, type LogEvent } from "../../helpers/types.js";
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
    assert.doesNotMatch(JSON.stringify(events), /secret-value|\/api\/requests/u);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalRetries === undefined) delete process.env.BIAWS_MCP_HTTP_RETRIES;
    else process.env.BIAWS_MCP_HTTP_RETRIES = originalRetries;
    if (originalUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalUrl;
  }
});
