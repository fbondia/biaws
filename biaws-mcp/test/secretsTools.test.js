import assert from "node:assert/strict";
import test from "node:test";

import { dispatchTool, listTools } from "../src/tools.js";

test("secret MCP schemas never accept secret contents", () => {
  const tools = listTools().filter(({ name }) => name.startsWith("secrets_"));
  assert.deepEqual(
    tools.map(({ name }) => name),
    [
      "secrets_move_to_collection",
      "secrets_list",
      "secrets_get",
      "secrets_register",
    ],
  );
  function propertyNames(schema) {
    return [
      ...Object.keys(schema?.properties || {}),
      ...Object.values(schema?.properties || {}).flatMap(propertyNames),
    ];
  }
  const names = tools.flatMap(({ inputSchema }) => propertyNames(inputSchema));
  for (const prohibited of ["value", "content", "contentBase64", "file"]) {
    assert.equal(names.includes(prohibited), false);
  }
});

test("secrets_register sends metadata to the registration endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.ISSUE_API_URL;
  const originalApiKey = process.env.ISSUE_API_KEY;
  const calls = [];
  process.env.ISSUE_API_URL = "http://127.0.0.1:3199";
  process.env.ISSUE_API_KEY = "biaws_test_key";
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ secret: { id: "secret-a" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await dispatchTool("secrets_register", {
      identifier: "github-token-production",
      name: "GitHub token",
      type: "token",
      environment: "production",
      applicationId: "application-a",
      contentKind: "text",
    });
    assert.equal(calls.length, 1);
    assert.equal(new URL(calls[0].url).pathname, "/api/secrets/registrations");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(
      calls[0].options.headers.Authorization,
      "Bearer biaws_test_key",
    );
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      identifier: "github-token-production",
      name: "GitHub token",
      type: "token",
      environment: "production",
      applicationId: "application-a",
      contentKind: "text",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.ISSUE_API_URL;
    else process.env.ISSUE_API_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.ISSUE_API_KEY;
    else process.env.ISSUE_API_KEY = originalApiKey;
  }
});
