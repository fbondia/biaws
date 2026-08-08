import assert from "node:assert/strict";
import test from "node:test";

import { collectionTools } from "../src/domains/collections/tools.js";
import { dispatchTool, listTools } from "../src/tools.js";

function jsonResponse(payload = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("collection tools expose bounded resource types and explicit destination ids", () => {
  assert.deepEqual(
    collectionTools.map(({ name }) => name),
    [
      "resource_collections_list",
      "resource_collections_create",
      "resource_collections_update",
      "resource_collections_delete",
      "applications_move_to_collection",
      "servers_move_to_collection",
      "secrets_move_to_collection",
      "skills_move_to_collection",
      "demands_move_to_collection",
      "documents_move_to_collection",
      "procedures_move_to_collection",
    ],
  );
  const registered = new Map(listTools().map((tool) => [tool.name, tool]));
  for (const tool of collectionTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(registered.has(tool.name), true, tool.name);
  }
  assert.deepEqual(
    registered.get("resource_collections_list").inputSchema.properties
      .resourceType.enum,
    [
      "applications",
      "demands",
      "documents",
      "procedures",
      "secrets",
      "skills",
      "servers",
    ],
  );
  for (const name of [
    "applications_move_to_collection",
    "servers_move_to_collection",
    "secrets_move_to_collection",
    "skills_move_to_collection",
    "demands_move_to_collection",
    "documents_move_to_collection",
    "procedures_move_to_collection",
  ]) {
    assert.equal(
      registered.get(name).inputSchema.required.includes("collectionId"),
      true,
      name,
    );
  }
});

test("resource collection tools route generic and procedure trees through the API", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.ISSUE_API_URL;
  process.env.ISSUE_API_URL = "http://api.test";
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse();
  };

  const cases = [
    [
      "resource_collections_list",
      { resourceType: "applications" },
      undefined,
      "/api/resource-collections/applications",
      undefined,
    ],
    [
      "resource_collections_create",
      { resourceType: "servers", name: "Produção", parentId: "infra" },
      "POST",
      "/api/resource-collections/servers",
      { name: "Produção", parentId: "infra" },
    ],
    [
      "resource_collections_update",
      {
        resourceType: "skills",
        collectionId: "ops/1",
        parentId: "platform",
      },
      "PATCH",
      "/api/resource-collections/skills/ops%2F1",
      { parentId: "platform" },
    ],
    [
      "resource_collections_delete",
      { resourceType: "secrets", collectionId: "unused" },
      "DELETE",
      "/api/resource-collections/secrets/unused",
      undefined,
    ],
    [
      "resource_collections_list",
      { resourceType: "procedures" },
      undefined,
      "/api/procedures/collections",
      undefined,
    ],
    [
      "resource_collections_create",
      { resourceType: "procedures", name: "Runbooks" },
      "POST",
      "/api/procedures/collections",
      { name: "Runbooks" },
    ],
  ];

  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      const [, , method, path, body] = cases[index];
      assert.equal(call.options.method, method);
      assert.equal(new URL(call.url).pathname, path);
      if (body) assert.deepEqual(JSON.parse(call.options.body), body);
      else assert.equal(call.options.body, undefined);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.ISSUE_API_URL;
    else process.env.ISSUE_API_URL = originalBaseUrl;
  }
});

test("move tools use audited API routes and support moving to root", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.ISSUE_API_URL;
  process.env.ISSUE_API_URL = "http://api.test";
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse();
  };
  const cases = [
    [
      "applications_move_to_collection",
      { applicationId: "app/1", collectionId: "business" },
      "/api/catalog/applications/app%2F1/collection",
      "business",
    ],
    [
      "servers_move_to_collection",
      { serverId: "server-1", collectionId: "infra" },
      "/api/catalog/servers/server-1/collection",
      "infra",
    ],
    [
      "secrets_move_to_collection",
      { secretId: "secret-1", collectionId: "" },
      "/api/secrets/secret-1/collection",
      "",
    ],
    [
      "skills_move_to_collection",
      { skillId: "skill-1", collectionId: "agents" },
      "/api/skills/skill-1/collection",
      "agents",
    ],
    [
      "demands_move_to_collection",
      { requestId: "request-1", collectionId: "roadmap" },
      "/api/requests/request-1/collection",
      "roadmap",
    ],
    [
      "procedures_move_to_collection",
      { procedureId: "procedure-1", collectionId: "runbooks" },
      "/api/procedures/procedure-1/collection",
      "runbooks",
    ],
    [
      "documents_move_to_collection",
      { documentId: "document-1", collectionId: "platform" },
      "/api/knowledge/documents/document-1/collection",
      "platform",
    ],
  ];

  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      const [, , path, collectionId] = cases[index];
      assert.equal(call.options.method, "PATCH");
      assert.equal(new URL(call.url).pathname, path);
      assert.deepEqual(JSON.parse(call.options.body), { collectionId });
    });
    await assert.rejects(
      dispatchTool("secrets_move_to_collection", { secretId: "secret-1" }),
      /collectionId is required/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.ISSUE_API_URL;
    else process.env.ISSUE_API_URL = originalBaseUrl;
  }
});

test("collection update requires a rename or a reparent operation", async () => {
  await assert.rejects(
    dispatchTool("resource_collections_update", {
      resourceType: "applications",
      collectionId: "collection-1",
    }),
    /at least one mutable field is required/u,
  );
});
