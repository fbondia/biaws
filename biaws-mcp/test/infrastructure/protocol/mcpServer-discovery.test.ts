import assert from "node:assert/strict";
import test from "node:test";
import { listResourceTemplates } from "../../../src/mcp/resources/resources.js";
import { listTools } from "../../../src/mcp/tools/tools.js";
import { connectTestServer } from "../../helpers/sdk.js";
import { required } from "../../helpers/types.js";
for (const mode of ["legacy", { pin: "2026-07-28" }] as const) {
  test(`official SDK discovers the preserved catalog (${JSON.stringify(mode)})`, async (t) => {
    const session = await connectTestServer({}, { versionNegotiation: { mode } });
    t.after(() => session.close());
    assert.deepEqual((await session.client.listTools()).tools, listTools());
    assert.deepEqual(
      (await session.client.listResourceTemplates()).resourceTemplates,
      listResourceTemplates().resourceTemplates,
    );
    assert.equal(required(session.client.getServerVersion()).version, "0.14.0");
    assert.equal((await session.client.listResources()).resources[0].uri, "biaws://workspaces");
  });
}
