import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
test("collection update requires a rename or a reparent operation", async () => {
  await assert.rejects(
    dispatchTool("resource_collections_update", {
      resourceType: "applications",
      collectionId: "collection-1",
    }),
    /at least one mutable field is required/u,
  );
});
