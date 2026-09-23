import assert from "node:assert/strict";
import test from "node:test";

import {
  getDemand,
  listDemandTasks,
  updateDemandTask,
} from "../src/domains/demands/service.js";

const demandId = "507f1f77bcf86cd799439011";

function response(payload) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

async function withMockApi(fetch, operation) {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  globalThis.fetch = fetch;
  try {
    await operation();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
}

test("task reads fetch a demand by ID without listing demands", async () => {
  const urls = [];
  await withMockApi(
    async (url) => {
      urls.push(String(url));
      return response({
        request: {
          id: demandId,
          clientCode: "BIAWS-1",
          tasks: [{ id: "task-1", title: "Check API" }],
        },
      });
    },
    async () => {
      const result = await listDemandTasks({ requestId: demandId });
      assert.equal(result.items[0].id, "task-1");
      assert.equal(result.request.id, demandId);
    },
  );
  assert.deepEqual(urls, [`http://api.test/api/requests/${demandId}`]);
});

test("client codes use the API's exact code filter", async () => {
  const urls = [];
  await withMockApi(
    async (url) => {
      urls.push(String(url));
      return response({
        meta: { total: 1 },
        items: [{ id: demandId, clientCode: "BIAWS-1" }],
      });
    },
    async () => {
      const result = await getDemand({ requestId: "BIAWS-1" });
      assert.equal(result.request.id, demandId);
      assert.equal(result.meta.total, 1);
    },
  );
  assert.deepEqual(urls, ["http://api.test/api/requests?code=BIAWS-1"]);
});

test("task updates read only the target demand before writing", async () => {
  const calls = [];
  await withMockApi(
    async (url, options = {}) => {
      const path = new URL(url).pathname;
      calls.push({ path, method: options.method || "GET" });
      if (path === `/api/requests/${demandId}`) {
        return response({
          request: {
            id: demandId,
            tasks: [{ id: "task-1", title: "Old title", status: "Pendente" }],
          },
        });
      }
      if (path === "/api/option-lists/runtime") {
        return response({
          items: [
            {
              key: "demand.task-status",
              defaultValue: "Pendente",
              items: [{ value: "Pendente", active: true }],
            },
          ],
        });
      }
      return response({ task: { id: "task-1", title: "New title" } });
    },
    async () => {
      await updateDemandTask({
        requestId: demandId,
        taskId: "task-1",
        title: "New title",
      });
    },
  );
  assert.deepEqual(calls, [
    { path: `/api/requests/${demandId}`, method: "GET" },
    { path: "/api/option-lists/runtime", method: "GET" },
    { path: `/api/requests/${demandId}/tasks/task-1`, method: "PUT" },
  ]);
});
