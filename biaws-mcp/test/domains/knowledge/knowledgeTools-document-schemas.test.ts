import assert from "node:assert/strict";
import test from "node:test";
import { DOCUMENT_TYPE_CATALOG as MCP_DOCUMENT_TYPE_CATALOG } from "../../../src/domains/knowledge/documentTypeCatalog.js";
import { knowledgeTools } from "../../../src/domains/knowledge/tools.js";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
import { SHARED_DOCUMENT_TYPE_CATALOG } from "./knowledgeTools.fixtures.js";
test("document tools expose one bounded discriminated knowledge API", () => {
  const names = knowledgeTools.map(({ name }) => name);
  assert.deepEqual(names, [
    "knowledge_context_load",
    "document_types_list",
    "documents_search",

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

  const create = required(knowledgeTools.find(({ name }) => name === "documents_create"));
  assert.deepEqual(create.inputSchema.required, ["documentType", "title", "summary", "markdown"]);
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
