import assert from "node:assert/strict";
import test from "node:test";
import { errorInfo, fieldErrors, required } from "./helpers/types.js";

import { DOCUMENT_TYPE_CATALOG as MCP_DOCUMENT_TYPE_CATALOG } from "../src/domains/knowledge/documentTypeCatalog.js";
import { knowledgeTools } from "../src/domains/knowledge/tools.js";
import { dispatchTool, listTools } from "../src/tools.js";
const { DOCUMENT_TYPE_CATALOG: SHARED_DOCUMENT_TYPE_CATALOG } = await import(
  new URL("../../../shared/documentTypes.js", import.meta.url).href
);

function jsonResponse(payload: unknown = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("document tools expose one bounded discriminated knowledge API", () => {
  const names = knowledgeTools.map(({ name }) => name);
  assert.deepEqual(names, [
    "knowledge_context_load",
    "document_types_list",
    "documents_search",
    "documents_get",
    "documents_list_revisions",
    "documents_list_observations",
    "documents_create",
    "documents_update",
    "documents_add_observation",
  ]);
  assert.equal(new Set(names).size, names.length);

  const registered = new Set(listTools().map(({ name }) => name));
  for (const tool of knowledgeTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(registered.has(tool.name), true, tool.name);
  }

  const create = required(
    knowledgeTools.find(({ name }) => name === "documents_create"),
  );
  assert.deepEqual(create.inputSchema.required, [
    "documentType",
    "title",
    "summary",
    "markdown",
  ]);
  assert.deepEqual(create.inputSchema.properties.documentType.enum, [
    "business-rule",
    "architecture-decision",
    "guideline",
    "feature",
    "technical-reference",
    "procedure",
  ]);
  assert.equal(create.inputSchema.properties.references.maxItems, 100);
  assert.ok(create.inputSchema.properties.identifier);
  assert.equal(required(create.inputSchema.oneOf).length, 10);
  assert.deepEqual(MCP_DOCUMENT_TYPE_CATALOG, SHARED_DOCUMENT_TYPE_CATALOG);
});

test("document type catalog exposes context, states and typed details", async () => {
  const result = await dispatchTool("document_types_list", {});
  assert.equal(result.documentTypes.length, 6);
  assert.equal(
    required(result.documentTypes.find(({ type }) => type === "business-rule"))
      .context.applicationId,
    "required",
  );
  assert.deepEqual(
    Reflect.get(
      required(result.documentTypes.find(({ type }) => type === "guideline"))
        .details,
      "scope",
    ).enum,
    ["workspace", "application", "component"],
  );
  const procedure = required(
    result.documentTypes.find(({ type }) => type === "procedure"),
  );
  assert.equal(procedure.context.applicationId, "optional");
  assert.deepEqual(procedure.details, {});
});

test("document creation validates its discriminated contract before HTTP", async () => {
  await assert.rejects(
    dispatchTool("documents_create", {
      documentType: "business-rule",
      title: "Rule",
      summary: "Summary",
      markdown: "# Rule",
    }),
    (error) =>
      errorInfo(error).code === "VALIDATION_ERROR" &&
      fieldErrors(error).some(({ path }) => path === "applicationId"),
  );
  await assert.rejects(
    dispatchTool("documents_create", {
      documentType: "guideline",
      title: "Guideline",
      summary: "Summary",
      markdown: "# Guideline",
      applicationId: "app-1",
      details: { scope: "workspace", enforcement: "recommended" },
    }),
    (error) => errorInfo(error).code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    dispatchTool("documents_create", {
      documentType: "technical-reference",
      title: "Reference",
      summary: "Summary",
      markdown: "# Reference",
      source: { mode: "repository" },
    }),
    (error) =>
      errorInfo(error).code === "VALIDATION_ERROR" &&
      fieldErrors(error).some(({ path }) => path === "source.repositoryId"),
  );
});

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
