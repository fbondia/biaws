import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { response, taxonomyPayload } from "./taxonomyTools.fixtures.js";
test("rejects duplicate, missing parent and empty taxonomy updates before writing", async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method) writes += 1;
    return response(taxonomyPayload([{ id: "operations", label: "Operations", applicationIds: [] }]));
  };

  try {
    await assert.rejects(
      dispatchTool("issues_create_taxonomy_item", {
        id: "operations",
        label: "Duplicate",
      }),
      /already exists/u,
    );
    await assert.rejects(
      dispatchTool("issues_create_taxonomy_item", {
        id: "deployments",
        label: "Deployments",
        parentId: "missing",
      }),
      /Parent taxonomy item not found/u,
    );
    await assert.rejects(
      dispatchTool("issues_update_taxonomy_item", {
        taxonomyId: "operations",
      }),
      /label or applicationIds is required/u,
    );
    assert.equal(writes, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
