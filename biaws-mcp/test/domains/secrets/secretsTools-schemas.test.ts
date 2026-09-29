import assert from "node:assert/strict";
import test from "node:test";
import { listTools } from "../../../src/mcp/tools/tools.js";
test("secret MCP schemas never accept secret contents", () => {
  const tools = listTools().filter(({ name }) => name.startsWith("secrets_"));
  assert.deepEqual(
    tools.map(({ name }) => name),
    ["secrets_move_to_collection", "secrets_list", "secrets_register"],
  );
  function propertyNames(
    schema: import("../../../src/mcp/tools/contracts.js").Schema,
  ): string[] {
    return [
      ...Object.keys(schema?.properties || {}),
      ...Object.values(schema?.properties || {}).flatMap(propertyNames),
    ];
  }
  const names = tools.flatMap(({ inputSchema }) => propertyNames(inputSchema));
  for (const prohibited of [
    "value",
    "content",
    "contentBase64",
    "file",
  ] as const) {
    assert.equal(names.includes(prohibited), false);
  }
});
