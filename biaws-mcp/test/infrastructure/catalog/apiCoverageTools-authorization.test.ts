import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { required, toolPayload } from "../../helpers/types.js";
import { withApi } from "./apiCoverageTools.fixtures.js";
test("API authorization failures are returned as MCP tool errors", async (t) => {
  await withApi(
    () => ({
      error: {
        code: "FORBIDDEN",
        message: "Denied",
        requiredPermissions: ["issues.update"],
      },
    }),
    async () => {
      const session = await connectTestServer();
      t.after(() => session.close());
      for (const [name, args] of [
        ["issues_update", { issueId: "i", title: "Changed" }],
        ["audit_events_list", { entityType: "issue", entityId: "i" }],
      ] as const) {
        const result = await session.client.callTool({ name, arguments: args });
        assert.equal(result.isError, true);
        assert.equal(
          required(toolPayload(result.structuredContent).error).status,
          403,
        );
        assert.equal(
          required(toolPayload(result.structuredContent).error).code,
          "FORBIDDEN",
        );
      }
    },
  );
});
