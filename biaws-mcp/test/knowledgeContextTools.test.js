import assert from "node:assert/strict";
import test from "node:test";

import { dispatchTool, listTools } from "../src/tools.js";

function response(payload = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("issue and demand creation schemas require applicationId", () => {
  const byName = new Map(listTools().map((tool) => [tool.name, tool]));
  for (const name of ["issues_create", "issues_import_eml", "demands_create"]) {
    assert.equal(
      byName.get(name).inputSchema.required.includes("applicationId"),
      true,
      name,
    );
  }
  for (const name of ["documents_create", "documents_update"]) {
    assert.equal(
      byName.get(name).inputSchema.required.includes("applicationId"),
      false,
      name,
    );
    assert.ok(byName.get(name).inputSchema.properties.affectedComponentIds);
  }
});

test("improvement tools expose the journey model", () => {
  const byName = new Map(listTools().map((tool) => [tool.name, tool]));
  const create = byName.get("demands_create");
  const journeyItems = create.inputSchema.properties.journeys.items.properties;

  assert.ok(byName.has("demands_journey_calendar"));
  assert.equal(byName.has("demands_billing_calendar"), false);
  assert.ok(journeyItems.plannedJourneys);
  assert.ok(journeyItems.executedJourneys);
  assert.equal(Object.hasOwn(journeyItems, "billedJourneys"), false);
  assert.equal(Object.hasOwn(create.inputSchema.properties, "billing"), false);
});

test("knowledge searches preserve their supported application context", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const urls = [];
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
    const documentQuery = new URL(urls.at(-1)).searchParams;
    assert.equal(documentQuery.get("workspaceId"), null);
    assert.equal(documentQuery.get("applicationId"), filters.applicationId);
    assert.equal(documentQuery.get("componentId"), filters.componentId);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});

test("knowledge creation serializes validated application context", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (new URL(url).pathname === "/api/option-lists/runtime") {
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
    const bodies = writes.map(({ options }) => JSON.parse(options.body));
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

test("EML import sends application context through multipart fields", async () => {
  const originalFetch = globalThis.fetch;
  let sentForm;
  globalThis.fetch = async (_url, options = {}) => {
    sentForm = options.body;
    return response({ mode: "dry-run" });
  };
  try {
    await dispatchTool("issues_import_eml", {
      filename: "issue.eml",
      contentBase64: Buffer.from("Subject: Example\n\nBody").toString("base64"),
      applicationId: "application-1",
      affectedComponentIds: ["component-1"],
    });
    assert.equal(sentForm.get("applicationId"), "application-1");
    assert.equal(
      sentForm.get("affectedComponentIds"),
      JSON.stringify(["component-1"]),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
