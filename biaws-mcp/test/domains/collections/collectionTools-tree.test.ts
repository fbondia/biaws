import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { jsonResponse } from "./collectionTools.fixtures.js";
test("resource collection tools route generic trees through the API", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse();
  };

  const cases = [
    [
      "resource_collections_create",
      { resourceType: "servers", name: "Produção", parentId: "infra" },
      "POST",
      "/api/resource-collections/servers",
      { name: "Produção", parentId: "infra" },
    ],
    [
      "resource_collections_update",
      {
        resourceType: "skills",
        collectionId: "ops/1",
        parentId: "platform",
      },
      "PATCH",
      "/api/resource-collections/skills/ops%2F1",
      { parentId: "platform" },
    ],
    [
      "resource_collections_delete",
      { resourceType: "secrets", collectionId: "unused" },
      "DELETE",
      "/api/resource-collections/secrets/unused",
      undefined,
    ],
  ] as const;

  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      const [, , method, path, body] = cases[index];
      assert.equal(call.options.method, method);
      assert.equal(new URL(call.url).pathname, path);
      if (body) assert.deepEqual(JSON.parse(String(call.options.body)), body);
      else assert.equal(call.options.body, undefined);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
