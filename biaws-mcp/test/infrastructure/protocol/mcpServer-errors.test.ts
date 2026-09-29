import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
import { textContent } from "../../helpers/types.js";
test("functional errors retain structured fields and leave the transport open", async (t) => {
  const session = await connectTestServer({
    dispatchTool: async (name) => {
      if (name === "fail")
        throw Object.assign(new Error("Permission denied"), {
          code: "FORBIDDEN",
          statusCode: 403,
          requiredPermissions: ["issues.write"],
          requestId: "api-123",
          retryable: false,
        });
      return { ok: true };
    },
  });
  t.after(() => session.close());
  const result = await session.client.callTool({ name: "fail" });
  assert.equal(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    error: {
      code: "FORBIDDEN",
      message: "Permission denied",
      status: 403,
      requiredPermissions: ["issues.write"],
      requestId: "api-123",
      retryable: false,
    },
  });
  assert.doesNotMatch(textContent(result.content[0]), /mcpServer.test/u);
  assert.deepEqual((await session.client.callTool({ name: "fast" })).structuredContent, { ok: true });
});
