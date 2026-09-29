import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { readCases } from "./apiCoverageTools.fixtures.js";
test("tools/list exposes remaining read tools with closed schemas", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  const catalog = await session.client.listTools();
  for (const name of [
    ...readCases.map(([name]) => name),
    "issues_update",
  ] as const) {
    const matches = catalog.tools.filter((tool) => tool.name === name);
    assert.equal(matches.length, 1, name);
    assert.equal(matches[0].inputSchema.additionalProperties, false, name);
  }
});
