import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
import { response, taxonomyPayload } from "./taxonomyTools.fixtures.js";
test("creates a taxonomy child and preserves the rest of the package", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) {
      return response(
        taxonomyPayload([
          {
            id: "operations",
            label: "Operations",
            applicationIds: ["app-1"],
          },
        ]),
      );
    }
    const body = JSON.parse(String(options.body));
    return response(taxonomyPayload(body.taxonomy));
  };

  try {
    const result = await dispatchTool("issues_create_taxonomy_item", {
      id: "deployments",
      label: " Deployments ",
      parentId: "operations",
      workspaceId: "workspace-1",
    });
    const write = calls[1];
    const body = JSON.parse(String(write.options.body));

    assert.equal(write.options.method, "PUT");
    assert.equal(
      new URL(write.url).searchParams.get("workspaceId"),
      "workspace-1",
    );
    assert.deepEqual(body.source, { path: "taxonomy.json" });
    assert.deepEqual(body.tagGroups, [
      { id: "environment", label: "Environment", tags: [] },
    ]);
    assert.deepEqual(body.taxonomy[0].children, [
      {
        id: "deployments",
        label: "Deployments",
        applicationIds: ["app-1"],
      },
    ]);
    assert.equal(required(result.item).id, "deployments");
    assert.equal(result.parentId, "operations");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
