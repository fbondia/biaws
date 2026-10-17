import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/api/httpClient.js";
import { currentApiIdentity, runWithRequestContext } from "../../../src/runtime/requestContext.js";
import { listResources } from "../../../src/mcp/resources/resources.js";
import { resourceLinksForTool } from "../../../src/mcp/resources/resourceLinks.js";

test("concurrent HTTP identities survive nested tool context without leaking into resources or stdio", async () => {
  const originalFetch = globalThis.fetch;
  const received: { token: string | null; workspace: string | null }[] = [];
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (_url, options = {}) => {
    const headers = new Headers(options.headers);
    received.push({ token: headers.get("Authorization"), workspace: headers.get("X-Biaws-Workspace-Id") });
    if (received.length === 2) release();
    await barrier;
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  };
  try {
    await Promise.all(
      ["a", "b"].map((id) =>
        runWithRequestContext(
          { transport: "http", authentication: { token: `token-${id}`, workspaceId: `workspace-${id}` } },
          () =>
            runWithRequestContext({ tool: "issues_list", requestId: id }, async () => {
              assert.equal(currentApiIdentity().workspaceId, `workspace-${id}`);
              assert.ok(listResources().resources.some((r) => r.uri === `biaws://workspaces/workspace-${id}`));
              assert.equal(
                resourceLinksForTool("issues_get", { issue: { id: "issue" } })[0].uri,
                `biaws://workspaces/workspace-${id}/issues/issue`,
              );
              await fetchJson("/api/issues");
              assert.equal(currentApiIdentity().token, `token-${id}`);
            }),
        ),
      ),
    );
    assert.deepEqual(
      received.sort((a, b) => String(a.workspace).localeCompare(String(b.workspace))),
      [
        { token: "Bearer token-a", workspace: "workspace-a" },
        { token: "Bearer token-b", workspace: "workspace-b" },
      ],
    );
    assert.equal(currentApiIdentity().workspaceId, String(process.env.BIAWS_WORKSPACE_ID || "").trim());
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("HTTP requests without identity fail closed instead of using stdio credentials", () => {
  runWithRequestContext({ transport: "http" }, () =>
    assert.throws(() => currentApiIdentity(), { code: "MCP_HTTP_UNAUTHENTICATED" }),
  );
});
