import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool, listTools } from "../src/tools.js";
import { connectTestServer } from "./helpers/sdk.js";

const demandId = "507f1f77bcf86cd799439011";
const request = {
  id: demandId,
  clientCode: "BIAWS-1",
  title: "Existing",
  startDate: "2026-09-01",
  endDate: "2026-10-31",
  specification: { sections: [{ id: "original", content: "Keep" }] },
  checklist: [{ label: "Original", done: true }],
  notes: [{ id: "note/1", date: "2026-09-10", content: "Old" }],
};
async function withApi(operation, status = 200) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = {
      path: new URL(url).pathname,
      search: new URL(url).search,
      method: options.method || "GET",
      body: options.body ? JSON.parse(options.body) : undefined,
    };
    calls.push(call);
    const reading = call.method === "GET";
    return new Response(
      JSON.stringify(
        reading
          ? { request, items: [request] }
          : status === 200
            ? { request }
            : { error: "Denied" },
      ),
      {
        status: reading ? 200 : status,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  try {
    await operation(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const newTools = [
  "demands_update",
  "demands_update_specification",
  "demands_update_checklist",
  "demands_update_journeys",
  "demands_update_note",
  "demands_delete_note",
];
test("tools/list advertises the six demand mutation contracts", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  const catalog = await session.client.listTools();
  for (const name of newTools) {
    const tool = catalog.tools.find((item) => item.name === name);
    assert.ok(tool, name);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(tool.inputSchema.required.includes("requestId"));
  }
});

test("metadata and description updates send only requested fields and resolve exact codes", async () => {
  await withApi(async (calls) => {
    await dispatchTool("demands_update", {
      requestId: " BIAWS-1 ",
      title: " New ",
      estimatedJourneys: 0,
      description: "",
      affectedComponentIds: [],
    });
    assert.equal(calls[0].path, "/api/requests/BIAWS-1");
    assert.equal(calls[0].search, "");
    assert.equal(calls[1].path, `/api/requests/${demandId}`);
    assert.equal(calls[1].method, "PUT");
    assert.deepEqual(calls[1].body, {
      title: "New",
      estimatedJourneys: 0,
      description: "",
      affectedComponentIds: [],
    });
    await dispatchTool("demands_update_description", {
      requestId: demandId,
      description: " Short ",
    });
    assert.deepEqual(calls.at(-1).body, { description: "Short" });
  });
});

for (const [name, args, expected] of [
  [
    "demands_update_specification",
    {
      specificationSections: [
        { id: "s1", title: "Scope", content: " **Markdown** ", order: 0 },
      ],
    },
    {
      specification: {
        sections: [
          { id: "s1", title: "Scope", content: " **Markdown** ", order: 0 },
        ],
      },
    },
  ],
  [
    "demands_update_checklist",
    {
      checklist: [
        { label: " Check ", done: false, date: "", comment: "Pending" },
      ],
    },
    {
      checklist: [
        { label: "Check", done: false, date: "", comment: "Pending" },
      ],
    },
  ],
  [
    "demands_update_journeys",
    {
      journeys: [{ month: "2026-09", plannedJourneys: 2, executedJourneys: 1 }],
    },
    {
      journeys: [{ month: "2026-09", plannedJourneys: 2, executedJourneys: 1 }],
    },
  ],
  [
    "demands_update_specification",
    { specificationSections: [] },
    { specification: { sections: [] } },
  ],
  ["demands_update_checklist", { checklist: [] }, { checklist: [] }],
  ["demands_update_journeys", { journeys: [] }, { journeys: [] }],
]) {
  test(`${name} sends an explicit replacement ${JSON.stringify(args)}`, async () => {
    await withApi(async (calls) => {
      const result = await dispatchTool(name, { requestId: demandId, ...args });
      assert.equal(result.request.id, demandId);
      assert.equal(calls.length, 2);
      assert.equal(calls[1].method, "PUT");
      assert.deepEqual(calls[1].body, expected);
    });
  });
}

test("note update preserves omitted dates, supports changing dates, and delete resolves codes", async () => {
  await withApi(async (calls) => {
    await dispatchTool("demands_update_note", {
      requestId: "BIAWS-1",
      noteId: " note/1 ",
      content: " Updated ",
    });
    assert.equal(calls.at(-1).path, `/api/requests/${demandId}/notes/note%2F1`);
    assert.deepEqual(calls.at(-1).body, {
      content: "Updated",
      date: "2026-09-10",
    });
    await dispatchTool("demands_update_note", {
      requestId: demandId,
      noteId: "note/1",
      content: "Changed",
      date: "2026-09-28",
    });
    assert.equal(calls.at(-1).body.date, "2026-09-28");
    await dispatchTool("demands_delete_note", {
      requestId: "BIAWS-1",
      noteId: "note/1",
    });
    assert.equal(calls.at(-1).method, "DELETE");
    assert.equal(calls.at(-1).path, `/api/requests/${demandId}/notes/note%2F1`);
  });
});

test("invalid input is rejected before any HTTP call", async () => {
  await withApi(async (calls) => {
    const cases = [
      ["demands_update", {}],
      ["demands_update", { title: "   " }],
      ["demands_update", { specification: {} }],
      ["demands_update", { estimatedJourneys: -1 }],
      ["demands_update_note", { noteId: "note/1", content: " " }],
      ["demands_delete_note", { noteId: " " }],
      [
        "demands_update_specification",
        {
          specificationSections: [
            { id: "a", title: "A", content: "", order: 0 },
            { id: "a", title: "B", content: "", order: 1 },
          ],
        },
      ],
      [
        "demands_update_checklist",
        {
          checklist: [
            { label: " A ", done: false },
            { label: "A", done: true },
          ],
        },
      ],
      [
        "demands_update_journeys",
        { journeys: [{ month: "2026-13", plannedJourneys: 1 }] },
      ],
      [
        "demands_update_journeys",
        {
          journeys: [
            { month: "2026-09", plannedJourneys: 1 },
            { month: "2026-09", plannedJourneys: 2 },
          ],
        },
      ],
    ];
    for (const [name, args] of cases)
      await assert.rejects(
        dispatchTool(name, { requestId: demandId, ...args }),
      );
    assert.equal(calls.length, 0);
  });
});

test("missing notes and journey months outside the period never mutate", async () => {
  await withApi(async (calls) => {
    await assert.rejects(
      dispatchTool("demands_delete_note", {
        requestId: demandId,
        noteId: "missing",
      }),
      /note not found/u,
    );
    await assert.rejects(
      dispatchTool("demands_update_journeys", {
        requestId: demandId,
        journeys: [{ month: "2026-08", plannedJourneys: 1 }],
      }),
      /startDate\/endDate/u,
    );
    assert.ok(calls.every((call) => call.method === "GET"));
  });
});

test("API permission errors remain visible to MCP callers", async (t) => {
  await withApi(async () => {
    const session = await connectTestServer();
    t.after(() => session.close());
    const result = await session.client.callTool({
      name: "demands_update_checklist",
      arguments: { requestId: demandId, checklist: [] },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.status, 403);
  }, 403);
});
