import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
import { jsonResponse } from "./knowledgeTools.fixtures.js";
test("knowledge context loader fetches current unified documents", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const calls: string[] = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(String(url));
    if (path.endsWith("/documents")) {
      return jsonResponse({
        items: [
          { id: "rule-1", documentType: "business-rule" },
          { id: "feature-1", documentType: "feature" },
        ],
      });
    }
    if (path.endsWith("/documents/rule-1")) {
      return jsonResponse({ document: { id: "rule-1", markdown: "# R" } });
    }
    return jsonResponse({ document: { id: "feature-1", markdown: "# F" } });
  };

  try {
    const result = await dispatchTool("knowledge_context_load", {
      applicationId: "app-1",
      componentId: "component-1",
      limit: 10,
    });
    assert.equal(required(required(result.documents)[0]).markdown, "# R");
    assert.equal(required(required(result.documents)[1]).markdown, "# F");
    assert.equal(
      calls.some((url) =>
        url.includes(
          "/api/knowledge/documents?applicationId=app-1&componentId=component-1&currentOnly=true&includeWorkspace=true&limit=10",
        ),
      ),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
