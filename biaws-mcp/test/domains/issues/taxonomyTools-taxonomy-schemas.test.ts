import assert from "node:assert/strict";
import test from "node:test";
import { listTools } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
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
