import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool, listTools } from "../src/tools.js";
import { createMcpMessageHandler } from "../src/mcpServer.js";

const readCases = [
  [
    "audit_events_list",
    { entityType: "demand", entityId: " demand/1 ", limit: 20 },
    "/api/audit/demand/demand%2F1",
    { limit: "20" },
  ],
  [
    "documents_list_revisions",
    { documentId: " doc/1 " },
    "/api/knowledge/documents/doc%2F1/revisions",
    {},
  ],
  [
    "documents_list_observations",
    { documentId: "doc-1" },
    "/api/knowledge/documents/doc-1/observations",
    {},
  ],
  [
    "monitoring_runtime_topology_get",
    {},
    "/api/monitoring/runtime-topology",
    {},
  ],
  [
    "monitoring_runtime_targets_list",
    {},
    "/api/monitoring/runtime-targets",
    {},
  ],
  [
    "monitoring_metadata_profiles_list",
    {},
    "/api/monitoring/metadata-profiles",
    {},
  ],
  [
    "applications_monitoring_health_get",
    { applicationId: " app/1 ", includeConfigured: true },
    "/api/monitoring/applications/app%2F1/health",
    { includeConfigured: "true" },
  ],
  [
    "runtime_monitoring_signals_list",
    {
      runtimeReference: "runtime/1",
      page: 2,
      limit: 10,
      status: "degraded",
      observedFrom: "2026-09-01",
      observedTo: "2026-09-28T10:00:00Z",
    },
    "/api/monitoring/runtimes/runtime%2F1/signals",
    {
      page: "2",
      limit: "10",
      status: "degraded",
      observedFrom: "2026-09-01",
      observedTo: "2026-09-28T10:00:00Z",
    },
  ],
];

async function withApi(handler, operation) {
  const original = globalThis.fetch;
  const originalWorkspace = process.env.BIAWS_WORKSPACE_ID;
  process.env.BIAWS_WORKSPACE_ID = "workspace-test";
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = {
      url: new URL(url),
      method: options.method || "GET",
      body: options.body ? JSON.parse(options.body) : undefined,
      headers: new Headers(options.headers),
    };
    calls.push(call);
    const payload = handler ? handler(call) : { items: [{ id: "result" }] };
    return new Response(JSON.stringify(payload), {
      status: payload.error ? 403 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await operation(calls);
  } finally {
    globalThis.fetch = original;
    if (originalWorkspace === undefined) delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = originalWorkspace;
  }
}

test("tools/list exposes all nine new tools with closed schemas", async () => {
  const messages = [];
  const server = createMcpMessageHandler({
    dispatchTool,
    listTools,
    writeMessage: (message) => messages.push(message),
  });
  await server.accept({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  for (const name of [...readCases.map(([name]) => name), "issues_update"]) {
    const matches = messages[0].result.tools.filter(
      (tool) => tool.name === name,
    );
    assert.equal(matches.length, 1, name);
    assert.equal(matches[0].inputSchema.additionalProperties, false, name);
  }
});

for (const [name, args, path, params] of readCases) {
  test(`${name} uses the scoped read endpoint and preserves its response`, async () => {
    await withApi(null, async (calls) => {
      const result = await dispatchTool(name, args);
      assert.deepEqual(result, { items: [{ id: "result" }] });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.pathname, path);
      assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), params);
      assert.equal(calls[0].method, "GET");
      assert.equal(
        calls[0].headers.get("x-biaws-workspace-id"),
        "workspace-test",
      );
    });
  });
}

test("read defaults are applied and bounded to API contracts", async () => {
  await withApi(null, async (calls) => {
    await dispatchTool("audit_events_list", {
      entityType: "issue",
      entityId: "issue-1",
    });
    assert.equal(calls.at(-1).url.searchParams.get("limit"), "100");
    await dispatchTool("runtime_monitoring_signals_list", {
      runtimeReference: "runtime-1",
    });
    assert.equal(calls.at(-1).url.searchParams.get("page"), "1");
    assert.equal(calls.at(-1).url.searchParams.get("limit"), "50");
    await dispatchTool("applications_monitoring_health_get", {
      applicationId: "app-1",
    });
    assert.equal(
      calls.at(-1).url.searchParams.get("includeConfigured"),
      "false",
    );
  });
});

test("issues_update writes only supplied mutable fields", async () => {
  await withApi(null, async (calls) => {
    await dispatchTool("issues_update", {
      issueId: " issue/1 ",
      title: " Revised ",
      text: " **Details** ",
      applicationId: " app-2 ",
      affectedComponentIds: [],
      type: "request",
      status: "closed",
    });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url.pathname, "/api/issues/issue%2F1");
    assert.deepEqual(calls[0].body, {
      title: "Revised",
      text: "**Details**",
      applicationId: "app-2",
      affectedComponentIds: [],
      type: "request",
      status: "closed",
    });
    await dispatchTool("issues_update", {
      issueId: "issue-1",
      title: "Only title",
    });
    assert.deepEqual(calls.at(-1).body, { title: "Only title" });
  });
});

test("invalid inputs never reach HTTP", async () => {
  await withApi(null, async (calls) => {
    for (const [name, args] of [
      ["audit_events_list", { entityType: "unknown", entityId: "id" }],
      [
        "audit_events_list",
        { entityType: "issue", entityId: "id", limit: 201 },
      ],
      ["audit_events_list", { entityType: "issue", entityId: " " }],
      ["documents_list_revisions", { documentId: " " }],
      ["documents_list_observations", { documentId: "doc", page: 1 }],
      ["monitoring_runtime_targets_list", { workspaceId: "other" }],
      [
        "runtime_monitoring_signals_list",
        { runtimeReference: "r", limit: 101 },
      ],
      [
        "runtime_monitoring_signals_list",
        { runtimeReference: "r", status: "invalid" },
      ],
      ["applications_monitoring_health_get", { applicationId: " " }],
      ["issues_update", { issueId: "i" }],
      ["issues_update", { issueId: "i", title: " " }],
      ["issues_update", { issueId: "i", affectedComponentIds: ["a", " a "] }],
      ["issues_update", { issueId: "i", affectedComponentIds: [" "] }],
      ["issues_update", { issueId: "i", status: "invalid" }],
      ["issues_update", { issueId: "i", source: {} }],
    ])
      await assert.rejects(dispatchTool(name, args));
    assert.equal(calls.length, 0);
  });
});

test("API authorization failures are returned as MCP tool errors", async () => {
  await withApi(
    () => ({
      error: {
        code: "FORBIDDEN",
        message: "Denied",
        requiredPermissions: ["issues.update"],
      },
    }),
    async () => {
      const messages = [];
      const server = createMcpMessageHandler({
        dispatchTool,
        listTools,
        writeMessage: (message) => messages.push(message),
      });
      for (const [name, args] of [
        ["issues_update", { issueId: "i", title: "Changed" }],
        ["audit_events_list", { entityType: "issue", entityId: "i" }],
        ["documents_list_revisions", { documentId: "d" }],
        ["monitoring_metadata_profiles_list", {}],
      ]) {
        await server.accept({
          jsonrpc: "2.0",
          id: messages.length + 1,
          method: "tools/call",
          params: { name, arguments: args },
        });
        assert.equal(messages.at(-1).result.isError, true);
        assert.equal(
          messages.at(-1).result.structuredContent.error.status,
          403,
        );
        assert.equal(
          messages.at(-1).result.structuredContent.error.code,
          "FORBIDDEN",
        );
      }
    },
  );
});
