import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../helpers/sdk.js";
import { required, toolPayload } from "../helpers/types.js";
import { W, withApi } from "./resources.fixtures.js";
test("search results include canonical resource links on supporting protocols", async (t) => {
  await withApi(
    () => assert.fail("discovery does not call HTTP"),
    async () => {
      const session = await connectTestServer({
        dispatchTool: async () => ({
          items: [{ id: "issue-a", title: "Incident" }],
        }),
      });
      t.after(() => session.close());
      const result = await session.client.callTool({ name: "issues_search" });
      assert.equal(result.content[1].type, "resource_link");
      assert.equal(result.content[1].uri, W + "/issues/issue-a");
      assert.equal(
        required(toolPayload(result.structuredContent).items)[0].id,
        "issue-a",
      );
    },
  );
});
