import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { required, toolPayload } from "../../helpers/types.js";
test("schema failures retain BIAWS isError validation without closing the transport", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  const result = await session.client.callTool({
    name: "demands_update_task_status",
    arguments: { requestId: "r", taskId: "t", status: "Em andamento" },
  });
  assert.equal(result.isError, true);
  assert.equal(
    required(toolPayload(result.structuredContent).error).code,
    "VALIDATION_ERROR",
  );
  assert.ok((await session.client.listTools()).tools.length > 0);
});
