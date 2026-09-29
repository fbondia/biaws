import assert from "node:assert/strict";
import test from "node:test";
import { readResource } from "../../src/mcp/resources/resources.js";
import { textContent } from "../helpers/types.js";
import { json, W, withApi } from "./resources.fixtures.js";
test("classification data comes from the issue application without a mutation or model call", async () => {
  const paths: string[] = [];
  await withApi(
    async (url, options) => {
      paths.push(url.pathname);
      assert.equal(options.method, undefined);
      if (url.pathname === "/api/catalog/applications/app-key") return json({ application: { id: "app-a" } });
      assert.equal(url.pathname, "/api/issues/taxonomy");
      assert.equal(url.searchParams.get("applicationId"), "app-a");
      return json({
        taxonomy: {
          taxonomy: [{ id: "network" }],
          tagGroups: [{ id: "priority", tags: ["high"] }],
        },
      });
    },
    async () => {
      const result = await readResource({
        uri: W + "/applications/app-key/classification-catalog",
      });
      assert.equal(JSON.parse(textContent(result.contents[0])).taxonomy.taxonomy[0].id, "network");
      assert.equal(result.contents[0].uri, W + "/applications/app-a/classification-catalog");
    },
  );
  assert.equal(paths.length, 2);
});
