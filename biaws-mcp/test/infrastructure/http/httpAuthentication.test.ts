import assert from "node:assert/strict";
import test from "node:test";
import { delegateIdentity } from "../../../src/http/authentication.js";
import { httpConfig } from "../../../src/http/config.js";
const config = httpConfig({
  BIAWS_MCP_PUBLIC_URL: "https://biaws.example.test/mcp",
  BIAWS_MCP_SERVICE_SECRET: "synthetic-service-secret".repeat(3),
});
test("HTTP validates bearer through its authorization server and retains only delegated identity", async () => {
  const original = "synthetic-external-token";
  const request = new Request(config.publicUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${original}`, "x-biaws-workspace-id": "attacker-choice" },
  });
  const identity = await delegateIdentity(request, config, async (input, options) => {
    assert.equal(String(input), "http://127.0.0.1:3100/api/auth/mcp/delegate");
    assert.deepEqual(JSON.parse(String(options?.body)), { subject_token: original });
    assert.equal(new Headers(options?.headers).get("x-biaws-mcp-service-secret"), config.serviceSecret);
    return Response.json({
      accessToken: "biaws_dlg_synthetic",
      workspaceId: "authorized-workspace",
      grantId: "grant",
      scopes: ["mcp:read"],
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    });
  });
  assert.equal(identity.workspaceId, "authorized-workspace");
  assert.equal(identity.token, "biaws_dlg_synthetic");
  assert.notEqual(identity.token, original);
});
test("HTTP rejects invalid and expired delegation responses", async () => {
  const request = new Request(config.publicUrl, { headers: { authorization: "Bearer synthetic" } });
  await assert.rejects(delegateIdentity(request, config, async () => Response.json({ accessToken: "external-token" })));
  await assert.rejects(
    delegateIdentity(request, config, async () => Response.json({ error: "invalid_token" }, { status: 401 })),
    { statusCode: 401 },
  );
  await assert.rejects(
    delegateIdentity(request, config, async () => Response.json({ error: "invalid_client" }, { status: 403 })),
    { statusCode: 503 },
  );
});
