import assert from "node:assert/strict";
import test from "node:test";
import { required } from "./helpers/types.js";

import { dispatchTool, listTools } from "../src/tools.js";

function response(payload: unknown = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function taxonomyPayload(taxonomy: unknown) {
  return {
    taxonomy: {
      schemaVersion: 1,
      source: { path: "taxonomy.json" },
      tagGroups: [{ id: "environment", label: "Environment", tags: [] }],
      taxonomy,
    },
  };
}

test("taxonomy mutation tools expose bounded schemas", () => {
  const tools = new Map(listTools().map((tool) => [tool.name, tool]));
  const create = tools.get("issues_create_taxonomy_item");
  const update = tools.get("issues_update_taxonomy_item");

  assert.deepEqual(required(create).inputSchema.required, ["id", "label"]);
  assert.deepEqual(required(update).inputSchema.required, ["taxonomyId"]);
  assert.equal(required(create).inputSchema.additionalProperties, false);
  assert.equal(required(update).inputSchema.additionalProperties, false);
  assert.ok(required(update).inputSchema.properties.applicationIds);
});

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

test("updates taxonomy item configuration without dropping descendants", async () => {
  const originalFetch = globalThis.fetch;
  let writtenBody:
    { taxonomy: import("../src/apiContracts.js").ApiEntity[] } | undefined;
  globalThis.fetch = async (_url, options = {}) => {
    if (!options.method) {
      return response(
        taxonomyPayload([
          {
            id: "operations",
            label: "Operations",
            applicationIds: [],
            children: [
              { id: "deployments", label: "Deployments", applicationIds: [] },
            ],
          },
        ]),
      );
    }
    writtenBody = JSON.parse(String(options.body));
    return response(taxonomyPayload(required(writtenBody).taxonomy));
  };

  try {
    const result = await dispatchTool("issues_update_taxonomy_item", {
      taxonomyId: "operations",
      label: "Platform operations",
      applicationIds: ["app-2", "app-2", " app-1 "],
    });

    assert.equal(
      required(writtenBody).taxonomy[0].label,
      "Platform operations",
    );
    assert.deepEqual(required(writtenBody).taxonomy[0].applicationIds, [
      "app-2",
      "app-1",
    ]);
    assert.equal(
      required(required(writtenBody).taxonomy[0].children)[0].id,
      "deployments",
    );
    assert.equal(required(result.item).label, "Platform operations");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects duplicate, missing parent and empty taxonomy updates before writing", async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method) writes += 1;
    return response(
      taxonomyPayload([
        { id: "operations", label: "Operations", applicationIds: [] },
      ]),
    );
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
