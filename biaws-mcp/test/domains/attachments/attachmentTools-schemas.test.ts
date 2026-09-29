import assert from "node:assert/strict";
import test from "node:test";
import { listTools } from "../../../src/mcp/tools/tools.js";
test("attachment tools expose the four supported file operations", () => {
  const tools = listTools().filter(({ name }) =>
    name.startsWith("attachments_"),
  );
  assert.deepEqual(
    tools.map(({ name }) => name),
    [
      "attachments_upload",
      "attachments_download",
      "attachments_update_tags",
      "attachments_delete",
    ],
  );
  for (const tool of tools) {
    assert.deepEqual(tool.inputSchema.properties.entityType.enum, [
      "issue",
      "demand",
      "task",
      "document",
    ]);
  }
});
