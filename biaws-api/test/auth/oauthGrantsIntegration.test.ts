import assert from "node:assert/strict";
import test from "node:test";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";
import { COLLECTION_NAMES } from "../../src/database/collectionNames.js";

test(
  "OAuth grants isolate flows and workspaces and recheck permissions, bans and revocation",
  { skip: !process.env.BIAWS_INTEGRATION_MONGO_URI },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();
    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { createWorkspace } = await import("../../src/repositories/catalog/index.js");
    const { createPermissionGroup, setUserGroups } = await import("../../src/repositories/access/index.js");
    const {
      ensureOAuthGrantIndexes,
      prepareOAuthGrant,
      authorizeOAuthGrant,
      requireOAuthGrant,
      resolveOAuthGrantActor,
      revokeOAuthGrant,
    } = await import("../../src/auth/oauthGrants.js");
    const db = await getMongoDatabase();
    try {
      await ensureOAuthGrantIndexes();
      const userId = "synthetic-oauth-user",
        operator = { userId: "synthetic-operator" };
      const users = db.collection<{
        _id: string;
        name: string;
        email: string;
        banned?: boolean;
      }>(COLLECTION_NAMES.AUTH_USERS);
      await users.insertOne({
        _id: userId,
        name: "OAuth",
        email: "oauth@example.test",
      });
      const a = await createWorkspace({ key: "oauth-a", name: "OAuth A" }, operator);
      const b = await createWorkspace({ key: "oauth-b", name: "OAuth B" }, operator);
      for (const workspace of [a, b]) {
        const group = await createPermissionGroup(
          {
            workspaceId: workspace.id,
            name: "OAuth operators",
            permissions: ["issues.read", "issues.create"],
            scope: { type: "workspace" },
          },
          { ...operator, workspaceId: workspace.id },
        );
        await setUserGroups(userId, [group.id], {
          ...operator,
          workspaceId: workspace.id,
        });
      }
      const actor = {
        userId,
        authenticationMethod: "session" as const,
        sessionId: "synthetic-session",
      };
      const query = (state: string) =>
        new URLSearchParams({
          client_id: "synthetic-client",
          redirect_uri: "https://client.example.test/cb",
          state,
          code_challenge: "synthetic-challenge",
          code_challenge_method: "S256",
          scope: "mcp:read mcp:write offline_access",
          resource: "https://biaws.example.test/mcp",
        }).toString();
      const [ga, gb] = await Promise.all([
        prepareOAuthGrant(actor, query("a"), a.id),
        prepareOAuthGrant(actor, query("b"), b.id),
      ]);
      assert.notEqual(ga.id, gb.id);
      await authorizeOAuthGrant(ga.id, userId, ["mcp:read"]);
      await authorizeOAuthGrant(gb.id, userId, ["mcp:read", "mcp:write"]);
      const aa = await resolveOAuthGrantActor(await requireOAuthGrant(ga.id, userId, ["mcp:read"]), ["mcp:read"]);
      const ab = await resolveOAuthGrantActor(await requireOAuthGrant(gb.id, userId, ["mcp:read", "mcp:write"]), [
        "mcp:read",
        "mcp:write",
      ]);
      assert.equal(aa.workspaceId, a.id);
      assert.equal(ab.workspaceId, b.id);
      assert.deepEqual(aa.permissions, ["issues.read"]);
      assert.ok(ab.permissions?.includes("issues.create"));
      await assert.rejects(prepareOAuthGrant(actor, query("a"), b.id), {
        code: "OAUTH_FLOW_ALREADY_USED",
      });
      await assert.rejects(requireOAuthGrant(ga.id, "other-user", ["mcp:read"]), { code: "OAUTH_GRANT_INVALID" });
      await setUserGroups(userId, [], { ...operator, workspaceId: b.id });
      assert.deepEqual((await resolveOAuthGrantActor(gb, ["mcp:read", "mcp:write"])).permissions, []);
      await users.updateOne({ _id: userId }, { $set: { banned: true } });
      await assert.rejects(resolveOAuthGrantActor(ga, ["mcp:read"]), {
        code: "OAUTH_USER_INACTIVE",
      });
      assert.equal(await revokeOAuthGrant(ga.id, userId), true);
      await assert.rejects(requireOAuthGrant(ga.id, userId, ["mcp:read"]), {
        code: "OAUTH_GRANT_INVALID",
      });
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
