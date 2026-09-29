import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { required, toolPayload } from "../../helpers/types.js";
import { demandId, withApi } from "./demandMutationTools.fixtures.js";
test("API permission errors remain visible to MCP callers", async (t) => {
  await withApi(async () => {
    const session = await connectTestServer();
    t.after(() => session.close());
    const result = await session.client.callTool({
      name: "demands_update_checklist",
      arguments: { requestId: demandId, checklist: [] },
    });
    assert.equal(result.isError, true);
    assert.equal(required(toolPayload(result.structuredContent).error).status, 403);
  }, 403);
});
