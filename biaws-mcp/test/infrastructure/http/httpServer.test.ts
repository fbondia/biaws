import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createBiawsHttpHandler } from "../../../src/http/handler.js";
import { httpConfig } from "../../../src/http/config.js";
import { currentApiIdentity } from "../../../src/runtime/requestContext.js";
const config = httpConfig({
  BIAWS_MCP_PUBLIC_URL: "https://biaws.example.test/mcp",
  BIAWS_MCP_SERVICE_SECRET: "synthetic-service-secret".repeat(3),
});
for (const mode of ["legacy", { pin: "2026-07-28" }] as const)
  test(`HTTP serves official SDK catalog and isolated calls (${JSON.stringify(mode)})`, async (t) => {
    const handler = createBiawsHttpHandler({
      config,
      authenticate: async () => ({
        token: "biaws_dlg_synthetic",
        workspaceId: "workspace",
        grantId: "grant",
        scopes: ["mcp:read"],
      }),
      serverOptions: { dispatchTool: async () => ({ workspace: currentApiIdentity().workspaceId }) },
    });
    const client = new Client({ name: "http-test", version: "0.0.0" }, { versionNegotiation: { mode } });
    const transport = new StreamableHTTPClientTransport(config.publicUrl, {
      fetch: async (input, init) => handler.fetch(new Request(input, init)),
    });
    t.after(async () => {
      await client.close();
      await handler.close();
    });
    await client.connect(transport);
    assert.ok((await client.listTools()).tools.length > 0);
    assert.ok((await client.listResources()).resources.some((r) => r.uri === "biaws://workspaces/workspace"));
    const result = await client.callTool({ name: "issues_list", arguments: {} });
    assert.equal(result.isError, undefined);
  });
test("HTTP rejects Host Origin and methods and exposes OAuth challenge without a token", async () => {
  const handler = createBiawsHttpHandler({ config });
  try {
    assert.equal((await handler.fetch(new Request("https://other.example.test/mcp", { method: "POST" }))).status, 403);
    assert.equal(
      (
        await handler.fetch(
          new Request(config.publicUrl, { method: "POST", headers: { origin: "https://evil.example.test" } }),
        )
      ).status,
      403,
    );
    assert.equal((await handler.fetch(new Request(config.publicUrl))).status, 405);
    const response = await handler.fetch(new Request(config.publicUrl, { method: "POST" }));
    assert.equal(response.status, 401);
    assert.ok(response.headers.get("www-authenticate")?.includes("oauth-protected-resource/mcp"));
    assert.ok(response.headers.get("www-authenticate")?.includes('scope="mcp:read mcp:write"'));
  } finally {
    await handler.close();
  }
});
