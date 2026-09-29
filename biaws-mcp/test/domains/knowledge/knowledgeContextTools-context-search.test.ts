import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { response } from "./knowledgeContextTools.fixtures.js";
test("knowledge searches preserve their supported application context", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return response({ items: [], meta: {} });
  };
  const filters = {
    workspaceId: "workspace-1",
    applicationId: "application-1",
    componentId: "component-1",
  };
  try {
    await dispatchTool("issues_search", filters);
    await dispatchTool("issues_by_taxonomy", {
      taxonomyId: "operations",
      ...filters,
    });
    await dispatchTool("demands_list", filters);
    await dispatchTool("documents_search", {
      applicationId: filters.applicationId,
      componentId: filters.componentId,
    });
    for (const url of urls.slice(0, 3)) {
      const query = new URL(url).searchParams;
      assert.equal(query.get("workspaceId"), filters.workspaceId, url);
      assert.equal(query.get("applicationId"), filters.applicationId, url);
      assert.equal(query.get("componentId"), filters.componentId, url);
    }
    const documentQuery = new URL(required(urls.at(-1))).searchParams;
    assert.equal(documentQuery.get("workspaceId"), null);
    assert.equal(documentQuery.get("applicationId"), filters.applicationId);
    assert.equal(documentQuery.get("componentId"), filters.componentId);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
