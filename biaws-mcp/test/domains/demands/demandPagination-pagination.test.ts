import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required, toolPayload } from "../../helpers/types.js";
import { demands, withApi } from "./demandPagination.fixtures.js";
test("demands_list forwards pagination and collection scope to the API", async () => {
  await withApi(async (calls) => {
    const result = await dispatchTool("demands_list", {
      page: 2,
      limit: 10,
      collectionId: "__root__",
      workspaceId: "workspace-1",
      applicationId: "app-1",
      componentId: "component-1",
      status: "Andamento",
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.fromEntries(calls[0]), {
      workspaceId: "workspace-1",
      applicationId: "app-1",
      componentId: "component-1",
      collectionId: "__root__",
      status: "Andamento",
      page: "2",
      limit: "10",
    });
    assert.equal(("items" in result ? result.items : []).length, 10);
    assert.equal(("items" in result ? result.items : [])[0].id, "demand-11");
    assert.equal(result.meta.total, 102);
    assert.equal(result.meta.totalPages, 11);
    assert.equal(result.meta.returned, 10);
    assert.equal(result.meta.page, 2);
    assert.equal(Reflect.get(result.items[0], "journeys"), undefined);
    const detailed = await dispatchTool("demands_list", {
      includeDetails: true,
    });
    assert.equal(required(calls.at(-1)).get("page"), "1");
    assert.equal(required(calls.at(-1)).get("limit"), "25");
    assert.equal(detailed.items.length, 25);
    assert.equal(required(toolPayload(detailed).items?.[0].journeys).length, 1);
  });
});

test("text and partial-code matching run before pagination across API pages", async () => {
  await withApi(async (calls) => {
    const result = await dispatchTool("demands_list", {
      text: "ALVO",
      page: 2,
      limit: 2,
      collectionId: "collection-1",
    });
    assert.deepEqual(
      ("items" in result ? result.items : []).map((item) => item.id),
      ["demand-101", "demand-102"],
    );
    assert.equal(result.meta.total, 4);
    assert.equal(result.meta.totalPages, 2);
    assert.equal(result.meta.page, 2);
    assert.deepEqual(
      calls.map((query) => query.get("page")),
      ["1", "2"],
    );
    assert.ok(
      calls.every(
        (query) =>
          query.get("limit") === "100" &&
          query.get("collectionId") === "collection-1",
      ),
    );
    const codes = await dispatchTool("demands_list", {
      code: "BIAWS-10",
      limit: 100,
    });
    assert.equal(codes.meta.total, 4); // 10, 100, 101, 102.
    assert.equal(required(codes.items.at(-1)).clientCode, "BIAWS-102");
  });
});

test("empty and legacy nonpaginated responses remain readable", async () => {
  await withApi(
    async (calls) => {
      const result = await dispatchTool("demands_list", { text: "absent" });
      assert.equal(("items" in result ? result.items : []).length, 0);
      assert.equal(result.meta.total, 0);
      assert.equal(result.meta.totalPages, 1);
      assert.equal(calls.length, 1);
    },
    () => ({ items: [], meta: { total: 0, totalPages: 1 } }),
  );
  await withApi(
    async (calls) => {
      const result = await dispatchTool("demands_journey_calendar", {});
      assert.equal(
        "totalRequests" in result.meta ? result.meta.totalRequests : undefined,
        102,
      );
      assert.equal(calls.length, 1);
    },
    () => ({ items: demands }),
  );
});

test("invalid pagination never reaches HTTP", async () => {
  await withApi(async (calls) => {
    await assert.rejects(dispatchTool("demands_list", { page: 0 }));
    await assert.rejects(dispatchTool("demands_list", { limit: 101 }));
    assert.equal(calls.length, 0);
  });
});
