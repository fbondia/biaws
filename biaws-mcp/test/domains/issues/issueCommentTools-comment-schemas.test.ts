import assert from "node:assert/strict";
import test from "node:test";
import { listTools } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
test("issue comment tools expose bounded schemas", () => {
  const tools = new Map(listTools().map((tool) => [tool.name, tool]));
  const add = tools.get("issues_add_comment");
  const update = tools.get("issues_update_comment");

  assert.deepEqual(required(add).inputSchema.required, ["issueId", "text"]);
  assert.deepEqual(required(update).inputSchema.required, [
    "issueId",
    "commentId",
    "text",
  ]);
  assert.equal(required(add).inputSchema.additionalProperties, false);
  assert.equal(required(update).inputSchema.additionalProperties, false);
});
