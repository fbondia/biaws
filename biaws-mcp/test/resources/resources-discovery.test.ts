import assert from "node:assert/strict";
import test from "node:test";
import {
  listResources,
  listResourceTemplates,
} from "../../src/mcp/resources/resources.js";
import { connectTestServer } from "../helpers/sdk.js";
import { required } from "../helpers/types.js";
test("the protocol discovers the resource hierarchy without subscriptions", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  assert.equal(
    required(required(session.client.getServerCapabilities()).resources)
      .subscribe,
    undefined,
  );
  assert.ok(
    (await session.client.listResourceTemplates()).resourceTemplates.some(
      (item) =>
        item.uriTemplate.endsWith("/issues/{issueId}/comments/{commentId}"),
    ),
  );
  assert.ok(
    listResourceTemplates().resourceTemplates.some((item) =>
      item.uriTemplate.endsWith(
        "/applications/{applicationId}/classification-catalog",
      ),
    ),
  );
  assert.equal(listResources().resources[0].uri, "biaws://workspaces");
});

test("advertised resource templates have unique URIs", () => {
  const { resourceTemplates } = listResourceTemplates();
  assert.ok(resourceTemplates.length > 0);
  assert.equal(
    new Set(resourceTemplates.map(({ uriTemplate }) => uriTemplate)).size,
    resourceTemplates.length,
  );
});
