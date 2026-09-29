import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { errorInfo, required } from "../../helpers/types.js";
import { demands, withApi } from "./demandPagination.fixtures.js";
for (const name of ["demands_journey_calendar", "demands_deadlines"] as const) {
  test(`${name} includes demands after the first API page`, async () => {
    await withApi(async (calls) => {
      const result = await dispatchTool(name, {
        applicationId: "app-1",
        collectionId: "collection-1",
        ...(name === "demands_deadlines"
          ? { referenceDate: "2026-09-28" }
          : {}),
      });
      assert.deepEqual(
        calls.map((query) => query.get("page")),
        ["1", "2"],
      );
      assert.ok(
        calls.every(
          (query) =>
            query.get("applicationId") === "app-1" &&
            query.get("collectionId") === "collection-1",
        ),
      );
      if (name === "demands_journey_calendar") {
        assert.equal(
          "totalRequests" in result.meta
            ? result.meta.totalRequests
            : undefined,
          102,
        );
        assert.equal(
          ("months" in result ? result.months : [])[0].plannedJourneys,
          102,
        );
        assert.equal(
          required(
            required(
              "months" in result ? result.months[0].requests : undefined,
            ).at(-1),
          ).id,
          "demand-102",
        );
      } else {
        assert.equal(("items" in result ? result.items : []).length, 102);
        assert.equal(
          required(("items" in result ? result.items : []).at(-1)).id,
          "demand-102",
        );
        assert.ok(
          ("items" in result ? result.items : []).every((item) => item.overdue),
        );
      }
    });
  });
}

test("aggregates stop on API errors instead of returning incomplete totals", async () => {
  await withApi(
    async (calls) => {
      await assert.rejects(
        dispatchTool("demands_journey_calendar", {}),
        (error) => errorInfo(error).statusCode === 403,
      );
      assert.equal(calls.length, 2);
    },
    (page) =>
      page === 2
        ? { error: "Denied" }
        : { items: [demands[0]], meta: { totalPages: 2 } },
  );
});

test("scan bound returns an explicit failure, not truncated aggregates", async () => {
  await withApi(
    async (calls) => {
      await assert.rejects(
        dispatchTool("demands_deadlines", {}),
        (error) =>
          errorInfo(error).code === "DEMAND_SCAN_LIMIT_EXCEEDED" &&
          errorInfo(error).retryable === false,
      );
      assert.equal(calls.length, 100);
    },
    () => ({ items: [demands[0]], meta: { totalPages: 101 } }),
  );
});
