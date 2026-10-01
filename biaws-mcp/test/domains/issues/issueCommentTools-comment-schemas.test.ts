import assert from "node:assert/strict";
import test from "node:test";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
test("issue comment tools expose bounded schemas", () => {
  const tools = new Map(listTools().map((tool) => [tool.name, tool]));
  const add = tools.get("issues_add_comment");
  const update = tools.get("issues_update_comment");
  const remove = tools.get("issues_delete_comment");

  assert.deepEqual(required(add).inputSchema.required, ["issueId", "text"]);
  assert.deepEqual(required(update).inputSchema.required, ["issueId", "commentId", "text"]);
  assert.deepEqual(required(remove).inputSchema.required, ["issueId", "commentId"]);
  assert.equal(required(add).inputSchema.additionalProperties, false);
  assert.equal(required(update).inputSchema.additionalProperties, false);
  assert.equal(required(remove).inputSchema.additionalProperties, false);
});
