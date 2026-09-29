import assert from "node:assert/strict";
import test from "node:test";
import {
  readResource,
  listResources,
  listResourceTemplates,
} from "../src/resources.js";
import { createMcpMessageHandler } from "../src/mcpServer.js";
import { currentRequestSignal } from "../src/requestContext.js";

const W = "biaws://workspaces/workspace-a";

async function withApi(handler, operation) {
  const originalFetch = globalThis.fetch;
  const originalWorkspace = process.env.BIAWS_WORKSPACE_ID;
  const originalBase = process.env.BIAWS_API_URL;
  process.env.BIAWS_WORKSPACE_ID = "workspace-a";
  process.env.BIAWS_API_URL = "http://api.test";
  globalThis.fetch = async (url, options) => handler(new URL(url), options);
  try {
    await operation();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWorkspace === undefined) delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = originalWorkspace;
    if (originalBase === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBase;
  }
}

function json(value) {
  return Response.json(value);
}

test("the protocol advertises resources and discovers the hierarchy without subscriptions", async () => {
  const messages = [];
  const server = createMcpMessageHandler({
    dispatchTool() {},
    listTools: () => [],
    writeMessage: (message) => messages.push(message),
  });
  await server.accept({ jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.deepEqual(messages[0].result.capabilities.resources, {});
  await server.accept({
    jsonrpc: "2.0",
    id: 2,
    method: "resources/templates/list",
  });
  assert.ok(
    messages[1].result.resourceTemplates.some((item) =>
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

test("item reads return canonical IDs and navigable children without embedding all comments or files", async () => {
  await withApi(
    async (url) => {
      assert.equal(url.pathname, "/api/issues/INC123");
      return json({
        issue: {
          id: "canonical-issue",
          workspaceId: "workspace-a",
          applicationId: "app-a",
          title: "Synthetic issue",
          attachments: [{ id: "file-a" }],
        },
        comments: [{ text: "Large child content" }],
      });
    },
    async () => {
      const result = await readResource({ uri: W + "/issues/INC123" });
      const payload = JSON.parse(result.contents[0].text);
      assert.equal(result.contents[0].uri, W + "/issues/canonical-issue");
      assert.equal(payload.comments, undefined);
      assert.equal(payload.issue.attachments, undefined);
      assert.ok(
        payload.links.some(
          (link) => link.uri === W + "/issues/canonical-issue/comments",
        ),
      );
      assert.ok(
        payload.links.some(
          (link) => link.uri === W + "/issues/canonical-issue/files",
        ),
      );
    },
  );
});

test("collection reads preserve pagination and link to individual comments", async () => {
  await withApi(
    async (url) => {
      assert.equal(url.pathname, "/api/issues/INC123/comments");
      assert.equal(url.searchParams.get("page"), "2");
      return json({
        context: { id: "canonical-issue" },
        items: [{ _id: "comment-a", text: "Evidence" }],
        meta: { page: 2, limit: 1, total: 2 },
      });
    },
    async () => {
      const result = await readResource({
        uri: W + "/issues/INC123/comments?page=2&limit=1",
      });
      const payload = JSON.parse(result.contents[0].text);
      assert.equal(payload.meta.page, 2);
      assert.equal(
        payload.links[0].uri,
        W + "/issues/canonical-issue/comments/comment-a",
      );
    },
  );
});

test("resource traversal, unsupported parameters and workspace changes fail before HTTP", async () => {
  await withApi(
    () => assert.fail("invalid URI must not reach HTTP"),
    async () => {
      for (const uri of [
        "biaws://workspaces/workspace-b/issues/id",
        W + "/issues/id?database=other",
        W + "/issues/id?limit=101",
        W + "/issues/id?page=9007199254740992",
        W + "/issues/%2Fetc",
        W + "/issues/%00",
        W + "/issues/id?limit=1&limit=2",
      ]) {
        await assert.rejects(readResource({ uri }));
      }
    },
  );
});

test("classification data comes from the issue application without a mutation or model call", async () => {
  const paths = [];
  await withApi(
    async (url, options) => {
      paths.push(url.pathname);
      assert.equal(options.method, undefined);
      if (url.pathname === "/api/catalog/applications/app-key")
        return json({ application: { id: "app-a" } });
      assert.equal(url.pathname, "/api/issues/taxonomy");
      assert.equal(url.searchParams.get("applicationId"), "app-a");
      return json({
        taxonomy: {
          taxonomy: [{ id: "network" }],
          tagGroups: [{ id: "priority", tags: ["high"] }],
        },
      });
    },
    async () => {
      const result = await readResource({
        uri: W + "/applications/app-key/classification-catalog",
      });
      assert.equal(
        JSON.parse(result.contents[0].text).taxonomy.taxonomy[0].id,
        "network",
      );
      assert.equal(
        result.contents[0].uri,
        W + "/applications/app-a/classification-catalog",
      );
    },
  );
  assert.equal(paths.length, 2);
});

test("file contents use blobs and canonical metadata without leaking storage locators", async () => {
  await withApi(
    async (url) =>
      url.pathname.endsWith("/metadata")
        ? json({ context: { id: "issue-a" }, value: { id: "file-a" } })
        : new Response(new Uint8Array([0, 255, 1]), {
            headers: { "content-type": "application/octet-stream" },
          }),
    async () => {
      const result = await readResource({
        uri: W + "/issues/INC123/files/file-a/content",
      });
      assert.equal(result.contents[0].blob, "AP8B");
      assert.equal(
        result.contents[0].uri,
        W + "/issues/issue-a/files/file-a/content",
      );
    },
  );
});

test("a resource outside a parent application fails instead of being mounted under a forged URI", async () => {
  await withApi(
    async (url) =>
      url.pathname.includes("/applications/")
        ? json({ application: { id: "app-a" } })
        : json({ deployment: { id: "deployment-a", applicationId: "app-b" } }),
    async () => {
      await assert.rejects(
        readResource({
          uri: W + "/applications/app-a/deployments/deployment-a",
        }),
        (error) => error.statusCode === 404,
      );
    },
  );
});

test("resources/read returns a numeric protocol error when a read fails", async () => {
  const messages = [];
  const server = createMcpMessageHandler({
    dispatchTool() {},
    listTools: () => [],
    readResource: async () => {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    },
    writeMessage: (message) => messages.push(message),
  });
  await server.accept({
    jsonrpc: "2.0",
    id: 3,
    method: "resources/read",
    params: { uri: W },
  });
  assert.equal(messages[0].error.code, -32002);
  assert.equal(messages[0].result, undefined);
});

test("a resource read can be cancelled without blocking tools on the same connection", async () => {
  const messages = [];
  const server = createMcpMessageHandler({
    dispatchTool: async () => ({ ok: true }),
    listTools: () => [],
    readResource: async () =>
      new Promise((resolve, reject) => {
        currentRequestSignal().addEventListener(
          "abort",
          () =>
            reject(
              Object.assign(new Error("Cancelled"), {
                code: "REQUEST_CANCELLED",
                statusCode: 499,
              }),
            ),
          { once: true },
        );
      }),
    writeMessage: (message) => messages.push(message),
  });
  const pending = server.accept({
    jsonrpc: "2.0",
    id: 10,
    method: "resources/read",
    params: { uri: W },
  });
  await server.accept({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "fast" },
  });
  assert.equal(messages[0].id, 11);
  await server.accept({
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: 10 },
  });
  await pending;
  assert.equal(messages[1].error.data.code, "REQUEST_CANCELLED");
});

test("search results link to resources when the negotiated protocol supports resource links", async () => {
  await withApi(
    () => assert.fail("discovery does not call HTTP"),
    async () => {
      const messages = [];
      const server = createMcpMessageHandler({
        dispatchTool: async () => ({
          items: [{ id: "issue-a", title: "Incident" }],
        }),
        listTools: () => [],
        writeMessage: (message) => messages.push(message),
      });
      await server.accept({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25" },
      });
      await server.accept({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "issues_search" },
      });
      assert.equal(messages[1].result.content[1].type, "resource_link");
      assert.equal(messages[1].result.content[1].uri, W + "/issues/issue-a");
      assert.equal(messages[1].result.structuredContent.items[0].id, "issue-a");
    },
  );
});
