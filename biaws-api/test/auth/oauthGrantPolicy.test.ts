import assert from "node:assert/strict";
import test from "node:test";
import { oauthFlow, restrictOAuthActor } from "../../src/auth/oauthGrantPolicy.js";
const query = new URLSearchParams({
  client_id: "client",
  redirect_uri: "https://client.example.test/cb",
  state: "state",
  code_challenge: "challenge",
  code_challenge_method: "S256",
  scope: "mcp:read offline_access",
  resource: "https://biaws.example.test/mcp",
});
test("OAuth flow identity ignores provider signatures but binds client PKCE state and resource", () => {
  const first = oauthFlow(query.toString());
  const signed = new URLSearchParams(query);
  signed.set("sig", "signature");
  signed.set("ba_pl", "session");
  assert.equal(oauthFlow(signed.toString()).key, first.key);
  signed.set("state", "different");
  assert.notEqual(oauthFlow(signed.toString()).key, first.key);
  signed.append("state", "duplicated");
  assert.throws(() => oauthFlow(signed.toString()));
});
test("read consent limits permissions and workspace without granting UI session rights", () => {
  const actor = restrictOAuthActor(
    {
      userId: "user",
      workspaceId: "a",
      workspaces: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      permissions: ["issues.read", "issues.create", "secrets.value.reveal"],
      platformPermissions: ["platform.workspaces.manage"],
      permissionScopes: {
        "issues.read": { applicationIds: ["app-a"] },
        "issues.create": { workspace: true },
      },
    },
    ["mcp:read"],
    { id: "grant", clientId: "client", workspaceId: "a" },
  );
  assert.deepEqual(actor.permissions, ["issues.read"]);
  assert.deepEqual(
    actor.workspaces?.map((w) => w.id),
    ["a"],
  );
  assert.deepEqual(actor.platformPermissions, []);
  assert.equal(actor.authenticationMethod, "oauth-delegated");
  assert.deepEqual(actor.permissionScopes, {
    "issues.read": { applicationIds: ["app-a"] },
  });
  assert.throws(() =>
    restrictOAuthActor(actor, ["mcp:read"], {
      id: "grant",
      clientId: "client",
      workspaceId: "b",
    }),
  );
});
