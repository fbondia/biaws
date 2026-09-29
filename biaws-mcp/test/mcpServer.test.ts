import assert from "node:assert/strict";
import test from "node:test";
import { currentRequestSignal } from "../src/requestContext.js";
import { listResourceTemplates } from "../src/resources.js";
import { listTools } from "../src/tools.js";
import { connectTestServer } from "./helpers/sdk.js";
import {
  recordEvents,
  required,
  textContent,
  toolPayload,
  type LogEvent,
} from "./helpers/types.js";

for (const mode of ["legacy", { pin: "2026-07-28" }] as const) {
  test(`official SDK discovers the preserved catalog (${JSON.stringify(mode)})`, async (t) => {
    const session = await connectTestServer(
      {},
      { versionNegotiation: { mode } },
    );
    t.after(() => session.close());
    assert.deepEqual((await session.client.listTools()).tools, listTools());
    assert.deepEqual(
      (await session.client.listResourceTemplates()).resourceTemplates,
      listResourceTemplates().resourceTemplates,
    );
    assert.equal(required(session.client.getServerVersion()).version, "0.11.0");
    assert.equal(
      (await session.client.listResources()).resources[0].uri,
      "biaws://workspaces",
    );
  });
}

test("functional errors retain structured fields and leave the transport open", async (t) => {
  const session = await connectTestServer({
    dispatchTool: async (name) => {
      if (name === "fail")
        throw Object.assign(new Error("Permission denied"), {
          code: "FORBIDDEN",
          statusCode: 403,
          requiredPermissions: ["issues.write"],
          requestId: "api-123",
          retryable: false,
        });
      return { ok: true };
    },
  });
  t.after(() => session.close());
  const result = await session.client.callTool({ name: "fail" });
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    error: {
      code: "FORBIDDEN",
      message: "Permission denied",
      status: 403,
      requiredPermissions: ["issues.write"],
      requestId: "api-123",
      retryable: false,
    },
  });
  assert.doesNotMatch(textContent(result.content[0]), /mcpServer.test/u);
  assert.deepEqual(
    (await session.client.callTool({ name: "fast" })).structuredContent,
    { ok: true },
  );
});

test("schema failures retain BIAWS isError validation without closing the transport", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  const result = await session.client.callTool({
    name: "demands_update_task_status",
    arguments: { requestId: "r", taskId: "t", status: "Em andamento" },
  });
  assert.equal(result.isError, true);
  assert.equal(
    required(toolPayload(result.structuredContent).error).code,
    "VALIDATION_ERROR",
  );
  assert.ok((await session.client.listTools()).tools.length > 0);
});

test("SDK cancellation reaches the request context while another call completes", async (t) => {
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let aborted: () => void = () => {};
  const cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  const session = await connectTestServer({
    dispatchTool: async (name) => {
      if (name === "fast") return { ok: true };
      return new Promise((resolve, reject) => {
        required(currentRequestSignal()).addEventListener(
          "abort",
          () => {
            aborted();
            reject(
              Object.assign(new Error("Cancelled"), {
                code: "REQUEST_CANCELLED",
                statusCode: 499,
              }),
            );
          },
          { once: true },
        );
        started();
      });
    },
  });
  t.after(() => session.close());
  const controller = new AbortController();
  const pending = session.client.callTool(
    { name: "slow" },
    { signal: controller.signal },
  );
  const rejected = assert.rejects(pending);
  await ready;
  assert.deepEqual(
    (await session.client.callTool({ name: "fast" })).structuredContent,
    { ok: true },
  );
  controller.abort();
  await rejected;
  await cancelled;
});

test("tool calls emit correlated lifecycle diagnostics", async (t) => {
  const events: LogEvent[] = [];
  const logger = recordEvents(events);
  const times = [100, 125];
  const session = await connectTestServer({
    dispatchTool: async () => ({ ok: true }),
    logger,
    createRequestId: () => "request-123",
    now: () => required(times.shift()),
  });
  t.after(() => session.close());
  await session.client.callTool({ name: "fast" });
  assert.deepEqual(
    events.map(({ event }) => event),
    ["mcp_tool_call_started", "mcp_tool_call_completed"],
  );
  assert.equal(events[0].fields.requestId, "request-123");
  assert.equal(events[0].fields.tool, "fast");
  assert.equal(events[1].fields.durationMs, 25);
});

for (const version of [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
  "2025-11-25",
] as const) {
  test(`official client negotiates ${version} and gates resource links`, async (t) => {
    const previous = process.env.BIAWS_WORKSPACE_ID;
    process.env.BIAWS_WORKSPACE_ID = "workspace-a";
    t.after(() => {
      if (previous === undefined) delete process.env.BIAWS_WORKSPACE_ID;
      else process.env.BIAWS_WORKSPACE_ID = previous;
    });
    const session = await connectTestServer(
      { dispatchTool: async () => ({ items: [{ id: "issue-a" }] }) },
      { supportedProtocolVersions: [version] },
    );
    t.after(() => session.close());
    assert.equal(session.client.getNegotiatedProtocolVersion(), version);
    const result = await session.client.callTool({ name: "issues_search" });
    assert.equal(
      result.content.some((item) => item.type === "resource_link"),
      ["2025-06-18", "2025-11-25"].includes(version),
    );
  });
}

test("SDK cancellation aborts HTTP and connection close aborts pending requests", async (t) => {
  const originalFetch = globalThis.fetch;
  let started: () => void = () => {};
  let aborted: () => void = () => {};
  let ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  globalThis.fetch = async (url, options) =>
    new Promise((resolve, reject) => {
      required(options?.signal).addEventListener(
        "abort",
        () => {
          aborted();
          reject(required(options?.signal).reason);
        },
        { once: true },
      );
      started();
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const session = await connectTestServer();
  t.after(() => session.close());
  const controller = new AbortController();
  const pending = session.client.callTool(
    { name: "issues_search" },
    { signal: controller.signal },
  );
  const rejection = assert.rejects(pending);
  await ready;
  assert.ok((await session.client.listTools()).tools.length > 0);
  controller.abort();
  await rejection;
  await cancelled;
  ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  const closing = session.client.callTool({ name: "issues_search" });
  const closed = assert.rejects(closing);
  await ready;
  await session.close();
  await closed;
  await cancelled;
});
