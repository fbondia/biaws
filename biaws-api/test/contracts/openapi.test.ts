import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { buildOpenApiDocument } from "../../src/contracts/openapi.js";
import { contractRouters } from "../../src/contracts/routers.js";
import { availablePort, restoreEnvironmentAfter } from "../support/integration.js";

const fixtureUrl = new URL("../fixtures/api-route-contract.json", import.meta.url);
const savedDocumentPath = resolve("openapi/openapi.json");

test("generated OpenAPI covers the independent router inventory with stable IDs and local references", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as Record<
    string,
    Array<{ path: string; methods: string[] }>
  >;
  const document = buildOpenApiDocument();
  const actual = new Set<string>();
  const ids = new Set<string>();
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item ?? {})) {
      if (!operation || !["get", "post", "put", "patch", "delete"].includes(method)) continue;
      actual.add(`${method} ${path}`);
      const id = "operationId" in operation ? operation.operationId : undefined;
      assert.equal(typeof id, "string");
      assert.equal(ids.has(id as string), false, `duplicate operationId: ${id}`);
      ids.add(id as string);
    }
  }
  const expected = new Set<string>(["get /api/health", "get /api/openapi.json"]);
  for (const { domain, prefix } of contractRouters) {
    for (const route of fixture[domain] ?? []) {
      if (!route.methods) continue;
      for (const method of route.methods) {
        const path = `${prefix}${route.path === "/" ? "" : route.path}`.replace(/:([A-Za-z][A-Za-z0-9_]*)/gu, "{$1}");
        expected.add(`${method} ${path}`);
      }
    }
  }
  assert.deepEqual(actual, expected);
  assert.equal(document.openapi, "3.1.0");
  assert.ok(document.components?.securitySchemes?.bearerApiKey);
  assert.ok(document.components?.securitySchemes?.sessionCookie);

  const serialized = JSON.stringify(document);
  for (const match of serialized.matchAll(/"\$ref":"([^"]+)"/gu)) {
    const reference = match[1];
    assert.ok(reference.startsWith("#/"), `external reference: ${reference}`);
    const target = reference
      .slice(2)
      .split("/")
      .reduce<unknown>(
        (value, segment) =>
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[segment.replace(/~1/gu, "/").replace(/~0/gu, "~")]
            : undefined,
        document,
      );
    assert.notEqual(target, undefined, `unresolved reference: ${reference}`);
  }
  assert.deepEqual(JSON.parse(await readFile(savedDocumentPath, "utf8")), document);
});

test("OpenAPI describes multipart uploads and binary downloads", () => {
  const document = buildOpenApiDocument();
  const upload = document.paths?.["/api/issues/{id}/attachments"]?.post;
  const download = document.paths?.["/api/issues/{id}/attachments/{attachmentId}"]?.get;
  assert.ok(upload?.requestBody);
  assert.ok(JSON.stringify(upload.requestBody).includes("multipart/form-data"));
  assert.ok(download?.responses?.["200"]);
  assert.ok(JSON.stringify(download.responses["200"]).includes("application/octet-stream"));
});

test(
  "public document endpoint returns the generated document",
  { skip: !process.env.BIAWS_HTTP_INTEGRATION },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.BETTER_AUTH_SECRET = "synthetic-api-review-openapi-test-secret";
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = "http://127.0.0.1:4400";
    if (process.env.BIAWS_INTEGRATION_MONGO_URI) {
      process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    }
    const { createApp } = await import("../../src/app.js");
    const port = await availablePort();
    const server = createApp().listen(port, "127.0.0.1");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/openapi.json`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
      const document = (await response.json()) as ReturnType<typeof buildOpenApiDocument>;
      assert.equal(document.openapi, "3.1.0");
      assert.ok(document.paths?.["/api/issues"]?.post);
      if (process.env.BIAWS_INTEGRATION_MONGO_URI) {
        const protectedResponse = await fetch(`http://127.0.0.1:${port}/api/issues`);
        assert.equal(protectedResponse.status, 401);
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      if (process.env.BIAWS_INTEGRATION_MONGO_URI) {
        const { closeMongoClient } = await import("../../src/helpers/mongoClient.js");
        await closeMongoClient();
      }
    }
  },
);
