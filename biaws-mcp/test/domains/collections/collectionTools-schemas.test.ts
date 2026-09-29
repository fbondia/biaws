import assert from "node:assert/strict";
import test from "node:test";
import { collectionTools } from "../../../src/domains/collections/tools.js";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
test("collection tools expose bounded resource types and explicit destination ids", () => {
  assert.deepEqual(
    collectionTools.map(({ name }) => name),
    [
      "resource_collections_create",
      "resource_collections_update",
      "resource_collections_delete",
      "applications_move_to_collection",
      "servers_move_to_collection",
      "secrets_move_to_collection",
      "skills_move_to_collection",
      "demands_move_to_collection",
      "documents_move_to_collection",
    ],
  );
  const registered = new Map(listTools().map((tool) => [tool.name, tool]));
  for (const tool of collectionTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(registered.has(tool.name), true, tool.name);
  }
  assert.deepEqual(
    required(registered.get("resource_collections_create")).inputSchema
      .properties.resourceType.enum,
    ["applications", "demands", "documents", "secrets", "skills", "servers"],
  );
  for (const name of [
    "applications_move_to_collection",
    "servers_move_to_collection",
    "secrets_move_to_collection",
    "skills_move_to_collection",
    "demands_move_to_collection",
    "documents_move_to_collection",
  ] as const) {
    assert.equal(
      required(required(registered.get(name)).inputSchema.required).includes(
        "collectionId",
      ),
      true,
      name,
    );
  }
});
