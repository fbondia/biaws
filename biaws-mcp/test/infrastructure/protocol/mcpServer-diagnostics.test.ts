import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { recordEvents, required, type LogEvent } from "../../helpers/types.js";
test("tool calls emit correlated lifecycle diagnostics", async (t) => {
  const events: LogEvent[] = [];
  const logger = recordEvents(events);
  const times = [100, 125];
  const session = await connectTestServer({
    dispatchTool: async () => ({ ok: true }),
    logger,
    createRequestId: () => "request-123",
    now: () => required(times.shift()),
  });
  t.after(() => session.close());
  await session.client.callTool({ name: "fast" });
  assert.deepEqual(
    events.map(({ event }) => event),
    ["mcp_tool_call_started", "mcp_tool_call_completed"],
  );
  assert.equal(events[0].fields.requestId, "request-123");
  assert.equal(events[0].fields.tool, "fast");
  assert.equal(events[1].fields.durationMs, 25);
});
