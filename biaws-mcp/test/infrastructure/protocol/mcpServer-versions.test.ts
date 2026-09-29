import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../../helpers/sdk.js";
for (const version of ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"] as const) {
  test(`official client negotiates ${version} and gates resource links`, async (t) => {
    const previous = process.env.BIAWS_WORKSPACE_ID;
    process.env.BIAWS_WORKSPACE_ID = "workspace-a";
    t.after(() => {
      if (previous === undefined) delete process.env.BIAWS_WORKSPACE_ID;
      else process.env.BIAWS_WORKSPACE_ID = previous;
    });
    const session = await connectTestServer(
      { dispatchTool: async () => ({ items: [{ id: "issue-a" }] }) },
      { supportedProtocolVersions: [version] },
    );
    t.after(() => session.close());
    assert.equal(session.client.getNegotiatedProtocolVersion(), version);
    const result = await session.client.callTool({ name: "issues_search" });
    assert.equal(
      result.content.some((item) => item.type === "resource_link"),
      ["2025-06-18", "2025-11-25"].includes(version),
    );
  });
}
