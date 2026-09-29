import assert from "node:assert/strict";
import test from "node:test";
import { currentRequestSignal } from "../src/requestContext.js";
import {
  listResources,
  listResourceTemplates,
  readResource,
} from "../src/resources.js";
import { connectTestServer } from "./helpers/sdk.js";
import {
  blobContent,
  errorInfo,
  required,
  textContent,
  toolPayload,
} from "./helpers/types.js";

const W = "biaws://workspaces/workspace-a";

async function withApi(
  handler: (url: URL, options: RequestInit) => Response | Promise<Response>,
  operation: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalWorkspace = process.env.BIAWS_WORKSPACE_ID;
  const originalBase = process.env.BIAWS_API_URL;
  process.env.BIAWS_WORKSPACE_ID = "workspace-a";
  process.env.BIAWS_API_URL = "http://api.test";
  globalThis.fetch = async (url, options) =>
    handler(new URL(url instanceof Request ? url.url : url), options || {});
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

function json(value: unknown) {
  return Response.json(value);
}

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
      const payload = JSON.parse(textContent(result.contents[0]));
      assert.equal(result.contents[0].uri, W + "/issues/canonical-issue");
      assert.equal(payload.comments, undefined);
      assert.equal(payload.issue.attachments, undefined);
      assert.ok(
        payload.links.some(
          (link: { uri: string }) =>
            link.uri === W + "/issues/canonical-issue/comments",
        ),
      );
      assert.ok(
        payload.links.some(
          (link: { uri: string }) =>
            link.uri === W + "/issues/canonical-issue/files",
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
      const payload = JSON.parse(textContent(result.contents[0]));
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
      ] as const) {
        await assert.rejects(readResource({ uri }));
      }
    },
  );
});

test("classification data comes from the issue application without a mutation or model call", async () => {
  const paths: string[] = [];
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
        JSON.parse(textContent(result.contents[0])).taxonomy.taxonomy[0].id,
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
      assert.equal(blobContent(result.contents[0]), "AP8B");
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
        (error) => errorInfo(error).statusCode === 404,
      );
    },
  );
});

test("resources/read returns a numeric SDK protocol error when a read fails", async (t) => {
  const session = await connectTestServer({
    readResource: async () => {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    },
  });
  t.after(() => session.close());
  await assert.rejects(
    session.client.readResource({ uri: W }),
    (error) =>
      error instanceof Error && "code" in error && error.code === -32602,
  );
});

test("SDK cancels a resource read without blocking tools on the connection", async (t) => {
  let started: () => void = () => {};
  let aborted: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const cancelled = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  const session = await connectTestServer({
    dispatchTool: async () => ({ ok: true }),
    readResource: async () =>
      new Promise((resolve, reject) => {
        required(currentRequestSignal()).addEventListener(
          "abort",
          () => {
            aborted();
            reject(
              Object.assign(new Error("Cancelled"), {
                code: "REQUEST_CANCELLED",
                statusCode: 499,
              }),
            );
          },
          { once: true },
        );
        started();
      }),
  });
  t.after(() => session.close());
  const controller = new AbortController();
  const pending = session.client.readResource(
    { uri: W },
    { signal: controller.signal },
  );
  const rejection = assert.rejects(pending);
  await ready;
  assert.deepEqual(
    (await session.client.callTool({ name: "fast" })).structuredContent,
    { ok: true },
  );
  controller.abort();
  await rejection;
  await cancelled;
});

test("search results include canonical resource links on supporting protocols", async (t) => {
  await withApi(
    () => assert.fail("discovery does not call HTTP"),
    async () => {
      const session = await connectTestServer({
        dispatchTool: async () => ({
          items: [{ id: "issue-a", title: "Incident" }],
        }),
      });
      t.after(() => session.close());
      const result = await session.client.callTool({ name: "issues_search" });
      assert.equal(result.content[1].type, "resource_link");
      assert.equal(result.content[1].uri, W + "/issues/issue-a");
      assert.equal(
        required(toolPayload(result.structuredContent).items)[0].id,
        "issue-a",
      );
    },
  );
});
