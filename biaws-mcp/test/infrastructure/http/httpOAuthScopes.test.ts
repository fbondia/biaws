import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from "@modelcontextprotocol/client";
import { createBiawsHttpHandler } from "../../../src/http/handler.js";
import { httpConfig } from "../../../src/http/config.js";

test("HTTP challenge makes the official OAuth client request read and write consent", async (t) => {
  const config = httpConfig({
    BIAWS_MCP_PUBLIC_URL: "https://biaws.example.test/mcp",
    BIAWS_MCP_SERVICE_SECRET: "synthetic-service-secret".repeat(3),
  });
  const issuer = "https://biaws.example.test/api/auth";
  const handler = createBiawsHttpHandler({ config });
  const client = new Client({ name: "oauth-scopes-test", version: "0.0.0" });
  const redirects: URL[] = [];
  let verifier = "";
  const transport = new StreamableHTTPClientTransport(config.publicUrl, {
    authProvider: {
      redirectUrl: "https://client.example.test/cb",
      clientMetadata: {
        redirect_uris: ["https://client.example.test/cb"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      clientInformation: () => ({ client_id: "synthetic-client" }),
      tokens: () => undefined,
      saveTokens: () => assert.fail("Consent is required before issuing tokens"),
      redirectToAuthorization: (url) => {
        redirects.push(url);
      },
      saveCodeVerifier: (value) => {
        verifier = value;
      },
      codeVerifier: () => verifier,
    },
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
        return Response.json({
          resource: config.publicUrl.href,
          authorization_servers: [issuer],
          scopes_supported: ["mcp:read", "mcp:write"],
        });
      }
      if (url.pathname === "/.well-known/oauth-authorization-server/api/auth") {
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/oauth2/authorize`,
          token_endpoint: `${issuer}/oauth2/token`,
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["none"],
          scopes_supported: ["mcp:read", "mcp:write", "offline_access"],
        });
      }
      assert.equal(request.url, config.publicUrl.href);
      return handler.fetch(request);
    },
  });
  t.after(async () => {
    await client.close();
    await handler.close();
  });

  await assert.rejects(client.connect(transport), UnauthorizedError);
  assert.equal(redirects.length, 1);
  assert.equal(redirects[0].origin + redirects[0].pathname, `${issuer}/oauth2/authorize`);
  assert.deepEqual(redirects[0].searchParams.get("scope")?.split(" "), ["mcp:read", "mcp:write", "offline_access"]);
  assert.equal(redirects[0].searchParams.get("resource"), config.publicUrl.href);
  assert.equal(redirects[0].searchParams.get("code_challenge_method"), "S256");
  assert.ok(verifier);
});
