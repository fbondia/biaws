import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, createHash } from "node:crypto";
import { createCimdClientDiscovery } from "@better-auth/cimd";
import { createAuthEndpoint } from "better-auth/api";
import { signJWT } from "better-auth/plugins/jwt";
import { COLLECTION_NAMES } from "../../src/database/collectionNames.js";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";

test(
  "BIAWS OAuth binds signed continuation and consent to a workspace grant",
  { skip: !process.env.BIAWS_INTEGRATION_MONGO_URI },
  async (t) => {
    restoreEnvironmentAfter(t);
    const base = "http://localhost:54801";
    Object.assign(process.env, {
      MONGO_URI: process.env.BIAWS_INTEGRATION_MONGO_URI,
      MONGO_DB: isolatedDatabaseName(),
      BIAWS_MCP_HTTP_ENABLED: "true",
      BIAWS_MCP_SERVICE_SECRET: randomBytes(32).toString("hex"),
      BIAWS_MCP_PUBLIC_URL: `${base}/mcp`,
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      BETTER_AUTH_TRUSTED_ORIGINS: base,
      BETTER_AUTH_SECURE_COOKIES: "false",
    });
    const { getAuth, getAuthenticatedActor } = await import("../../src/auth/auth.js");
    const { getMongoDatabase, closeMongoClient } = await import("../../src/helpers/mongoClient.js");
    const { createWorkspace } = await import("../../src/repositories/catalog/index.js");
    const { createPermissionGroup, setUserGroups } = await import("../../src/repositories/access/index.js");
    const { prepareOAuthGrant, requireOAuthGrant, revokeOAuthGrant } = await import("../../src/auth/oauthGrants.js");
    const { oauthConsentContext, decideOAuthConsent } = await import("../../src/auth/oauthConsent.js");
    const db = await getMongoDatabase();
    try {
      const auth = await getAuth();
      const created = await auth.api.createUser({
        body: {
          email: "flow@example.test",
          password: "Synthetic-flow-password-42",
          name: "Flow",
        },
      });
      const login = await auth.api.signInEmail({
        body: {
          email: "flow@example.test",
          password: "Synthetic-flow-password-42",
        },
        asResponse: true,
      });
      let cookie = login.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      let session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      assert.ok(session);
      const workspace = await createWorkspace({ key: "oauth-flow", name: "Flow" }, { userId: "synthetic-operator" });
      const group = await createPermissionGroup(
        {
          workspaceId: workspace.id,
          name: "Flow readers",
          permissions: ["issues.read"],
          scope: { type: "workspace" },
        },
        { userId: "synthetic-operator", workspaceId: workspace.id },
      );
      await setUserGroups(created.user.id, [group.id], {
        userId: "synthetic-operator",
        workspaceId: workspace.id,
      });
      const call = (path: string, body?: Record<string, unknown> | URLSearchParams, withSession = true) =>
        auth.handler(
          new Request(`${base}${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              ...(withSession ? { cookie } : {}),
              origin: base,
              ...(body
                ? {
                    "content-type":
                      body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json",
                  }
                : {}),
            },
            body: body ? (body instanceof URLSearchParams ? body : JSON.stringify(body)) : undefined,
          }),
        );
      const registration = await call("/api/auth/oauth2/create-client", {
        client_name: "Flow test",
        redirect_uris: ["https://client.example.test/cb"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        scope: "mcp:read offline_access",
      });
      assert.equal(registration.status, 201);
      const clientRegistration = (await registration.json()) as { client_id: string };
      // Use a synthetic HTTPS metadata document; no network or customer data.
      // Exercise the same initialized provider for registered and CIMD clients.
      const cimdClientId = "https://client.example.com/oauth-metadata.json";
      const provider = (await auth.$context).getPlugin("oauth-provider");
      assert.ok(provider);
      let metadataReads = 0;
      provider.options.extensions = [
        {
          clientDiscovery: createCimdClientDiscovery({
            metadataProfile: "mcp-2026-07-28",
            fetchClientMetadataResource: async (input) => {
              assert.equal(String(input), cimdClientId);
              metadataReads++;
              return Response.json(
                {
                  client_id: cimdClientId,
                  client_name: "CIMD flow test",
                  redirect_uris: ["https://client.example.test/cb"],
                  token_endpoint_auth_method: "none",
                  grant_types: ["authorization_code", "refresh_token"],
                  response_types: ["code"],
                  scope: "mcp:read offline_access",
                },
                { headers: { "cache-control": "public, max-age=3600" } },
              );
            },
          }),
        },
      ];
      for (const client of [clientRegistration, { client_id: cimdClientId }]) {
        if (client.client_id === cimdClientId) {
          const nextLogin = await auth.api.signInEmail({
            body: { email: "flow@example.test", password: "Synthetic-flow-password-42" },
            asResponse: true,
          });
          cookie = nextLogin.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .join("; ");
          session = await auth.api.getSession({ headers: new Headers({ cookie }) });
        }
        assert.ok(session);
        const verifier = randomBytes(32).toString("base64url");
        const query = new URLSearchParams({
          client_id: client.client_id,
          redirect_uri: "https://client.example.test/cb",
          response_type: "code",
          scope: "mcp:read offline_access",
          resource: `${base}/mcp`,
          state: "state",
          code_challenge: createHash("sha256").update(verifier).digest("base64url"),
          code_challenge_method: "S256",
        });
        const authorize = await call(`/api/auth/oauth2/authorize?${query}`);
        assert.equal(authorize.status, 302);
        const choice = new URL(authorize.headers.get("location")!, base);
        const deniedQuery = new URLSearchParams(query);
        deniedQuery.set("state", "denied-flow");
        const deniedStart = await call(`/api/auth/oauth2/authorize?${deniedQuery}`);
        const deniedChoice = new URL(deniedStart.headers.get("location")!, base);
        const denied = await decideOAuthConsent(
          {
            userId: created.user.id,
            authenticationMethod: "session",
            sessionId: session.session.id,
          },
          { cookie },
          { query: deniedChoice.searchParams.toString(), accept: false },
        );
        assert.equal(new URL(denied.redirectUrl).searchParams.get("error"), "access_denied");
        const forged = new URLSearchParams(choice.searchParams);
        forged.set("state", "forged");
        await assert.rejects(
          decideOAuthConsent(
            {
              userId: created.user.id,
              authenticationMethod: "session",
              sessionId: session.session.id,
            },
            { cookie },
            { query: forged.toString(), accept: true, workspaceId: workspace.id },
          ),
          { code: "OAUTH_CONTINUATION_REJECTED" },
        );
        const consentContext = await oauthConsentContext({ cookie }, choice.searchParams.toString());
        assert.equal(consentContext.clientId, client.client_id);
        assert.deepEqual(consentContext.scopes, ["mcp:read", "offline_access"]);
        await assert.rejects(
          decideOAuthConsent(
            {
              userId: created.user.id,
              authenticationMethod: "session",
              sessionId: session.session.id,
            },
            { cookie },
            { query: choice.searchParams.toString(), accept: true, workspaceId: "forbidden" },
          ),
        );
        const grant = await prepareOAuthGrant(
          {
            userId: created.user.id,
            authenticationMethod: "session",
            sessionId: session.session.id,
          },
          choice.searchParams.toString(),
          workspace.id,
        );
        const decision = await decideOAuthConsent(
          {
            userId: created.user.id,
            authenticationMethod: "session",
            sessionId: session.session.id,
          },
          { cookie },
          { query: choice.searchParams.toString(), accept: true, workspaceId: workspace.id },
        );
        const redirect = new URL(decision.redirectUrl);
        const exchanged = await call(
          "/api/auth/oauth2/token",
          new URLSearchParams({
            grant_type: "authorization_code",
            code: redirect.searchParams.get("code")!,
            client_id: client.client_id,
            redirect_uri: "https://client.example.test/cb",
            resource: `${base}/mcp`,
            code_verifier: verifier,
          }),
        );
        const tokens = (await exchanged.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          error?: string;
          error_description?: string;
        };
        assert.equal(
          exchanged.status,
          200,
          JSON.stringify({
            error: tokens.error,
            description: tokens.error_description,
          }),
        );
        const claims = JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString());
        assert.equal(claims.biaws_grant_id, grant.id);
        assert.equal(claims.biaws_workspace_id, workspace.id);
        assert.equal(typeof tokens.refresh_token, "string");
        assert.equal(tokens.expires_in, 3600);
        const context = await auth.$context;
        const refresh = (token: string) =>
          call(
            "/api/auth/oauth2/token",
            new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: token,
              client_id: client.client_id,
              resource: `${base}/mcp`,
            }),
            false,
          );
        const refreshed = await call(
          "/api/auth/oauth2/token",
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: tokens.refresh_token,
            client_id: client.client_id,
            resource: `${base}/mcp`,
          }),
        );
        if (refreshed.status !== 200) {
          const failure = (await refreshed.json()) as Record<string, unknown>;
          assert.fail(
            JSON.stringify({
              error: failure.error,
              error_description: failure.error_description,
              message: failure.message,
            }),
          );
        }
        const delegate = (secret: string, token: string) =>
          auth.handler(
            new Request(`${base}/api/auth/mcp/delegate`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-biaws-mcp-service-secret": secret },
              body: JSON.stringify({ subject_token: token }),
            }),
          );
        assert.equal((await delegate("wrong", tokens.access_token)).status, 403);
        const response = await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token);
        const delegation = (await response.json()) as { accessToken: string; workspaceId: string };
        assert.equal(response.status, 200, JSON.stringify(delegation));
        assert.notEqual(delegation.accessToken, tokens.access_token);
        const refreshedTokens = (await refreshed.json()) as { access_token: string; refresh_token: string };
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, refreshedTokens.access_token)).status, 200);
        const actorRequest = (token: string, workspaceId: string) => ({
          headers: { authorization: `Bearer ${token}`, "x-biaws-workspace-id": workspaceId },
        });
        const delegatedActor = await getAuthenticatedActor(actorRequest(delegation.accessToken, workspace.id));
        assert.equal(delegatedActor?.userId, created.user.id);
        assert.equal(delegatedActor?.authenticationMethod, "oauth-delegated");
        assert.deepEqual(delegatedActor?.permissions, ["issues.read"]);
        await assert.rejects(getAuthenticatedActor(actorRequest(delegation.accessToken, "other-workspace")), {
          code: "DELEGATION_WORKSPACE_MISMATCH",
        });
        assert.equal((await requireOAuthGrant(grant.id, created.user.id, ["mcp:read"])).workspaceId, workspace.id);

        const sign = (patch: Record<string, unknown>, typ = "at+jwt") =>
          createAuthEndpoint("/synthetic-sign", { method: "POST" }, (ctx) =>
            signJWT(ctx, { payload: { ...claims, ...patch }, header: { typ } }),
          )({ context });
        // These tokens have real signatures from this instance. Reject them on
        // their claims, not merely because a tampered signature is invalid.
        for (const patch of [
          { iss: "https://other.example.test/api/auth" },
          { aud: "https://other.example.test/mcp" },
          { exp: Math.floor(Date.now() / 1000) - 60 },
          { sub: "other-user" },
          { client_id: "other-client", azp: "other-client" },
          { biaws_workspace_id: "other-workspace" },
          { biaws_grant_id: "other-grant" },
          { cnf: { jkt: "synthetic-dpop-thumbprint" } },
        ]) {
          assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, await sign(patch))).status, 401);
        }
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, await sign({}, "JWT"))).status, 401);
        assert.equal(
          (await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, await sign({ scope: "mcp:write" }))).status,
          403,
        );
        const tampered = tokens.access_token.split(".");
        tampered[1] = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 3600 })).toString("base64url");
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tampered.join("."))).status, 401);
        if (client.client_id === clientRegistration.client_id) {
          await context.adapter.update({
            model: "oauthClient",
            where: [{ field: "clientId", value: client.client_id }],
            update: { disabled: true },
          });
          assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token)).status, 401);
          await context.adapter.update({
            model: "oauthClient",
            where: [{ field: "clientId", value: client.client_id }],
            update: { disabled: false },
          });
        }
        await context.adapter.update({
          model: "user",
          where: [{ field: "id", value: created.user.id }],
          update: { banned: true },
        });
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token)).status, 401);
        assert.equal((await refresh(refreshedTokens.refresh_token)).status, 400);
        await context.adapter.update({
          model: "user",
          where: [{ field: "id", value: created.user.id }],
          update: { banned: false },
        });

        // An expired browser session must not invalidate an already issued JWT
        // or prevent an OAuth refresh made without cookies.
        await context.adapter.update({
          model: "session",
          where: [{ field: "id", value: session.session.id }],
          update: { expiresAt: new Date(Date.now() - 60_000) },
        });
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token)).status, 200);
        const afterExpiry = await refresh(refreshedTokens.refresh_token);
        assert.equal(afterExpiry.status, 200, "offline refresh survives expired login");
        const expiryTokens = (await afterExpiry.json()) as { access_token: string; refresh_token: string };
        assert.notEqual(expiryTokens.refresh_token, refreshedTokens.refresh_token);
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, expiryTokens.access_token)).status, 200);

        // Make the current refresh nearly expire, then log out through the real
        // provider. Its replacement must receive a full new year, not the
        // original token's remaining lifetime.
        const currentRefresh = await db.collection("oauthRefreshToken").findOne({
          referenceId: grant.id,
          revoked: null,
        });
        assert.ok(currentRefresh);
        assert.ok(Math.abs(currentRefresh.expiresAt.getTime() - Date.now() - 365 * 24 * 60 * 60 * 1000) < 10_000);
        await db
          .collection("oauthRefreshToken")
          .updateOne({ _id: currentRefresh._id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });
        assert.equal((await refresh(expiryTokens.refresh_token)).status, 400, "expired refresh tokens remain invalid");
        await db
          .collection("oauthRefreshToken")
          .updateOne({ _id: currentRefresh._id }, { $set: { expiresAt: new Date(Date.now() + 60_000) } });
        await context.adapter.update({
          model: "session",
          where: [{ field: "id", value: session.session.id }],
          update: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
        });
        assert.equal((await call("/api/auth/sign-out", {})).status, 200);
        assert.equal(
          await db.collection(COLLECTION_NAMES.AUTH_SESSIONS).countDocuments({ userId: created.user.id }),
          0,
        );
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token)).status, 200);
        const afterLogout = await refresh(expiryTokens.refresh_token);
        assert.equal(afterLogout.status, 200, "offline refresh survives logout and deletion of the original session");
        const logoutTokens = (await afterLogout.json()) as { access_token: string; refresh_token: string };
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, logoutTokens.access_token)).status, 200);
        const rotatedRefresh = await db
          .collection("oauthRefreshToken")
          .findOne({ referenceId: grant.id, revoked: null });
        assert.ok(rotatedRefresh);
        assert.ok(Math.abs(rotatedRefresh.expiresAt.getTime() - Date.now() - 365 * 24 * 60 * 60 * 1000) < 10_000);

        await revokeOAuthGrant(grant.id, created.user.id);
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token)).status, 401);
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, logoutTokens.access_token)).status, 401);
        const revokedRefresh = await refresh(logoutTokens.refresh_token);
        assert.equal(revokedRefresh.status, 400, "revoking the connection also prevents refresh");
        assert.equal(((await revokedRefresh.json()) as { error: string }).error, "invalid_grant");
        await assert.rejects(getAuthenticatedActor(actorRequest(delegation.accessToken, workspace.id)), {
          code: "OAUTH_GRANT_INVALID",
        });
      }
      assert.ok(metadataReads > 0, "CIMD metadata was resolved through the provider extension");
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
