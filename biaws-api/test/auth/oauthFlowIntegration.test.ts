import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, createHash } from "node:crypto";
import { createCimdClientDiscovery } from "@better-auth/cimd";
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
      const cookie = login.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      const session = await auth.api.getSession({
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
      const call = (path: string, body?: Record<string, unknown> | URLSearchParams) =>
        auth.handler(
          new Request(`${base}${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              cookie,
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
        const refreshedTokens = (await refreshed.json()) as { access_token: string };
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
        await revokeOAuthGrant(grant.id, created.user.id);
        assert.equal((await delegate(process.env.BIAWS_MCP_SERVICE_SECRET!, tokens.access_token)).status, 401);
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
