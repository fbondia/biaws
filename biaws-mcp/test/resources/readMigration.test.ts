import assert from "node:assert/strict";
import test from "node:test";
import { isRecord } from "../../src/runtime/errors.js";
import { connectTestServer } from "../helpers/sdk.js";
import { required, textContent, toolPayload } from "../helpers/types.js";
import { replacements } from "./readMigration.fixtures.js";
import { json, W, withApi } from "./resources.fixtures.js";

for (const mode of ["legacy", { pin: "2026-07-28" }] as const) {
  test(`redundant read tools are absent and rejected (${JSON.stringify(mode)})`, async (t) => {
    const session = await connectTestServer(
      {},
      { versionNegotiation: { mode } },
    );
    t.after(() => session.close());
    const catalog = await session.client.listTools();
    assert.equal(catalog.tools.length, 98);
    for (const { name } of replacements) {
      assert.equal(
        catalog.tools.some((tool) => tool.name === name),
        false,
        name,
      );
      const result = await session.client.callTool({ name });
      assert.equal(result.isError, true);
      assert.equal(
        required(toolPayload(result.structuredContent).error).code,
        "TOOL_NOT_FOUND",
      );
    }
  });
}
for (const replacement of replacements) {
  test(`resource substitutes ${replacement.name} with the same GET and data`, async (t) => {
    let calls = 0;
    const previousKey = process.env.BIAWS_API_KEY;
    process.env.BIAWS_API_KEY = "test-read-migration";
    t.after(() => {
      if (previousKey === undefined) delete process.env.BIAWS_API_KEY;
      else process.env.BIAWS_API_KEY = previousKey;
    });
    await withApi(
      (url, options) => {
        calls += 1;
        assert.equal(url.pathname + url.search, replacement.path);
        assert.equal(options.method, undefined);
        assert.equal(
          new Headers(options.headers).get("authorization"),
          "Bearer test-read-migration",
        );
        assert.equal(
          new Headers(options.headers).get("x-biaws-workspace-id"),
          "workspace-a",
        );
        return json(replacement.payload);
      },
      async () => {
        const session = await connectTestServer();
        t.after(() => session.close());
        assert.ok(
          (await session.client.listResourceTemplates()).resourceTemplates.some(
            (def) => def.uriTemplate === replacement.template,
          ),
        );
        const result = await session.client.readResource({
          uri: replacement.uri,
        });
        const payload: unknown = JSON.parse(textContent(result.contents[0]));
        assert.ok(isRecord(payload));
        const { uri, links, ...data } = payload;
        assert.deepEqual(data, replacement.payload);
        assert.equal(uri, replacement.canonical);
        assert.equal(result.contents[0].uri, replacement.canonical);
        assert.equal(calls, 1, "does not require extra ancestor permissions");
      },
    );
  });
}
for (const [status, code] of [
  [401, "UNAUTHENTICATED"],
  [403, "FORBIDDEN"],
  [404, "NOT_FOUND"],
  [409, "AMBIGUOUS_REFERENCE"],
] as const) {
  test(`replacement resource preserves API error ${status}`, async (t) => {
    await withApi(
      () =>
        new Response(
          JSON.stringify({
            error: {
              code,
              message: "Denied",
              requiredPermissions: ["components.read"],
              retryable: false,
            },
          }),
          { status },
        ),
      async () => {
        const session = await connectTestServer();
        t.after(() => session.close());
        await assert.rejects(
          session.client.readResource({ uri: W + "/components/key" }),
          (error) => {
            assert.ok(isRecord(error));
            assert.ok(isRecord(error.data));
            assert.equal(error.data.code, code);
            assert.equal(error.data.status, status);
            return true;
          },
        );
      },
    );
  });
}
test("version selection and opaque template IDs survive migration", async (t) => {
  await withApi(
    (url) => {
      assert.equal(
        url.pathname + url.search,
        "/api/monitoring/templates/health%2Fapi?version=2",
      );
      return json({ template: { id: "health/api", version: "2" } });
    },
    async () => {
      const session = await connectTestServer();
      t.after(() => session.close());
      await session.client.readResource({
        uri: W + "/monitoring/templates/health%2Fapi/versions/2",
      });
      await assert.rejects(
        session.client.readResource({
          uri: W + "/monitoring/templates/health%2F..%2Fapi",
        }),
      );
    },
  );
});

test("direct replacements reject another workspace before HTTP", async (t) => {
  await withApi(
    () => assert.fail("workspace mismatch must not call HTTP"),
    async () => {
      const session = await connectTestServer();
      t.after(() => session.close());
      await assert.rejects(
        session.client.readResource({
          uri: "biaws://workspaces/other/components/id",
        }),
        (error) => {
          assert.ok(isRecord(error));
          assert.ok(isRecord(error.data));
          assert.equal(error.data.code, "WORKSPACE_NOT_FOUND");
          return true;
        },
      );
    },
  );
});

test("cancellation of a direct replacement reaches HTTP while catalog stays usable", async (t) => {
  let start: () => void = () => {};
  let abort: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const aborted = new Promise<void>((resolve) => {
    abort = resolve;
  });
  await withApi(
    (_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        required(options.signal).addEventListener(
          "abort",
          () => {
            abort();
            reject(required(options.signal).reason);
          },
          { once: true },
        );
        start();
      }),
    async () => {
      const session = await connectTestServer();
      t.after(() => session.close());
      const controller = new AbortController();
      const pending = session.client.readResource(
        { uri: W + "/components/id" },
        { signal: controller.signal },
      );
      const rejected = assert.rejects(pending);
      await started;
      assert.equal((await session.client.listTools()).tools.length, 98);
      controller.abort();
      await rejected;
      await aborted;
    },
  );
});

test("remaining search tools emit direct links readable with the entity permission", async (t) => {
  const paths: string[] = [];
  await withApi(
    (url) => {
      paths.push(url.pathname);
      if (url.pathname === "/api/catalog/applications/app/components")
        return json({
          items: [{ id: "component-id", applicationId: "app", name: "API" }],
        });
      assert.equal(url.pathname, "/api/catalog/components/component-id");
      return json({
        component: { id: "component-id", applicationId: "app", name: "API" },
      });
    },
    async () => {
      const session = await connectTestServer();
      t.after(() => session.close());
      const found = await session.client.callTool({
        name: "components_list",
        arguments: { applicationId: "app" },
      });
      const link = required(
        found.content.find((item) => item.type === "resource_link"),
      );
      assert.equal(link.type, "resource_link");
      if (link.type !== "resource_link") assert.fail("expected resource link");
      assert.equal(link.uri, W + "/components/component-id");
      await session.client.readResource({ uri: link.uri });
      assert.deepEqual(paths, [
        "/api/catalog/applications/app/components",
        "/api/catalog/components/component-id",
      ]);
    },
  );
});
