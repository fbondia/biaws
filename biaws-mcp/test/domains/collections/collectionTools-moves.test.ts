import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { jsonResponse } from "./collectionTools.fixtures.js";
test("move tools use audited API routes and support moving to root", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const calls: { url: string; options: RequestInit }[] = [];
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
      "documents_move_to_collection",
      { documentId: "document-1", collectionId: "platform" },
      "/api/knowledge/documents/document-1/collection",
      "platform",
    ],
  ] as const;

  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      const [, , path, collectionId] = cases[index];
      assert.equal(call.options.method, "PATCH");
      assert.equal(new URL(call.url).pathname, path);
      assert.deepEqual(JSON.parse(String(call.options.body)), { collectionId });
    });
    await assert.rejects(
      dispatchTool("secrets_move_to_collection", { secretId: "secret-1" }),
      /collectionId is required/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
