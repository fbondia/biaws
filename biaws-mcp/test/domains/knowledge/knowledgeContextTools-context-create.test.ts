import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { response } from "./knowledgeContextTools.fixtures.js";
test("knowledge creation serializes validated application context", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (
      new URL(url instanceof Request ? url.url : url).pathname ===
      "/api/option-lists/runtime"
    ) {
      return response({
        items: [
          {
            key: "demand.status",
            defaultValue: "Backlog",
            items: [{ value: "Backlog", active: true }],
          },
          {
            key: "demand.task-status",
            defaultValue: "Pendente",
            items: [{ value: "Pendente", active: true }],
          },
        ],
      });
    }
    return response({ ok: true });
  };
  const context = {
    workspaceId: "workspace-1",
    applicationId: "application-1",
    affectedComponentIds: ["component-1"],
  };
  try {
    await dispatchTool("issues_create", {
      title: "Issue",
      text: "Description",
      ...context,
    });
    await dispatchTool("demands_create", {
      title: "Demand",
      description: "Description",
      estimatedJourneys: 1,
      specificationSections: [
        {
          id: "scope",
          title: "Scope",
          content: "Implement",
          order: 0,
        },
      ],
      ...context,
    });
    await dispatchTool("documents_create", {
      documentType: "procedure",
      title: "Procedure",
      summary: "Summary",
      markdown: "Steps",
      applicationId: context.applicationId,
      affectedComponentIds: context.affectedComponentIds,
    });

    const writes = calls.filter(
      ({ options }) => options.body && !(options.body instanceof FormData),
    );
    const bodies = writes.map(({ options }) =>
      JSON.parse(String(options.body)),
    );
    assert.equal(bodies.length, 3);
    for (const body of bodies.slice(0, 2)) {
      assert.equal(body.workspaceId, context.workspaceId);
      assert.equal(body.applicationId, context.applicationId);
      assert.deepEqual(body.affectedComponentIds, context.affectedComponentIds);
    }
    assert.equal(Object.hasOwn(bodies[2], "workspaceId"), false);
    assert.equal(bodies[2].applicationId, context.applicationId);
    assert.deepEqual(
      bodies[2].affectedComponentIds,
      context.affectedComponentIds,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
