import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { demandId, withApi } from "./demandMutationTools.fixtures.js";
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
    assert.deepEqual(required(calls.at(-1)).body, { description: "Short" });
  });
});
