import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { required } from "../../helpers/types.js";
import { newTools } from "./demandMutationTools.fixtures.js";
test("tools/list advertises the six demand mutation contracts", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  const catalog = await session.client.listTools();
  for (const name of newTools) {
    const tool = required(catalog.tools.find((item) => item.name === name));
    assert.ok(tool, name);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(required(tool.inputSchema.required).includes("requestId"));
  }
});
