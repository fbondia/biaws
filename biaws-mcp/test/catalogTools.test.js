import assert from "node:assert/strict";
import test from "node:test";

import { catalogTools } from "../src/domains/catalog/tools.js";
import { dispatchTool, listTools } from "../src/tools.js";

function jsonResponse(payload = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("catalog tools are registered once with explicit bounded schemas", () => {
  const expected = [
    "workspaces_list",
    "workspaces_get",
    "applications_list",
    "applications_get",
    "applications_get_context",
    "components_list",
    "components_get",
    "integrations_list",
    "integrations_get",
    "repositories_list",
    "repositories_get",
    "servers_list",
    "servers_get",
    "deployments_list",
    "deployments_get",
    "runtimes_list",
    "runtimes_get",
    "applications_create",
    "applications_update",
    "components_create",
    "components_update",
    "integrations_create",
    "integrations_update",
    "repositories_create",
    "repositories_update",
    "servers_create",
    "servers_update",
    "deployments_create",
    "deployments_update",
    "runtimes_create",
    "runtimes_update",
  ];
  assert.deepEqual(
    catalogTools.map(({ name }) => name),
    expected,
  );
  const registered = listTools();
  assert.equal(
    new Set(registered.map(({ name }) => name)).size,
    registered.length,
  );
  for (const tool of catalogTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(
      registered.some(({ name }) => name === tool.name),
      true,
      tool.name,
    );
  }
  assert.equal(
    catalogTools.find(({ name }) => name === "applications_get_context")
      .inputSchema.properties.limit.maximum,
    100,
  );
  for (const name of [
    "applications_update",
    "components_update",
    "integrations_update",
    "repositories_update",
    "servers_update",
    "deployments_update",
    "runtimes_update",
  ]) {
    assert.equal(
      Object.hasOwn(
        catalogTools.find((tool) => tool.name === name).inputSchema.properties,
        "key",
      ),
      false,
      name,
    );
  }
  assert.equal(
    Object.hasOwn(
      catalogTools.find((tool) => tool.name === "deployments_update")
        .inputSchema.properties,
      "componentId",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      catalogTools.find((tool) => tool.name === "integrations_update")
        .inputSchema.properties,
      "targetApplicationId",
    ),
    false,
  );
});

test("catalog read tools dispatch only to their scoped HTTP endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.ISSUE_API_URL;
  process.env.ISSUE_API_URL = "http://api.test";
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse();
  };
  const cases = [
    ["workspaces_list", {}, "/api/catalog/workspaces"],
    [
      "workspaces_get",
      { workspaceId: "ws/1" },
      "/api/catalog/workspaces/ws%2F1",
    ],
    [
      "applications_list",
      { workspaceId: "ws-1", q: "billing", limit: 10 },
      "/api/catalog/workspaces/ws-1/applications?q=billing&limit=10",
    ],
    [
      "applications_get",
      { applicationId: "app-1" },
      "/api/catalog/applications/app-1",
    ],
    [
      "applications_get_context",
      { applicationId: "app-1", limit: 5, includeArchived: true },
      "/api/catalog/applications/app-1/context?limit=5&includeArchived=true",
    ],
    [
      "components_list",
      { applicationId: "app-1", type: "api" },
      "/api/catalog/applications/app-1/components?type=api",
    ],
    [
      "components_get",
      { componentId: "component-1" },
      "/api/catalog/components/component-1",
    ],
    [
      "integrations_list",
      { applicationId: "app-1", q: "customer" },
      "/api/catalog/applications/app-1/integrations?q=customer",
    ],
    [
      "integrations_get",
      { integrationId: "integration-1" },
      "/api/catalog/integrations/integration-1",
    ],
    [
      "repositories_list",
      { applicationId: "app-1", provider: "github" },
      "/api/catalog/applications/app-1/repositories?provider=github",
    ],
    [
      "repositories_get",
      { repositoryId: "repository-1" },
      "/api/catalog/repositories/repository-1",
    ],
    [
      "servers_list",
      { workspaceId: "ws-1" },
      "/api/catalog/workspaces/ws-1/servers",
    ],
    ["servers_get", { serverId: "server-1" }, "/api/catalog/servers/server-1"],
    [
      "deployments_list",
      { applicationId: "app-1", componentId: "component-1" },
      "/api/catalog/applications/app-1/deployments?componentId=component-1",
    ],
    [
      "deployments_get",
      { deploymentId: "deployment-1" },
      "/api/catalog/deployments/deployment-1",
    ],
    [
      "runtimes_list",
      { deploymentId: "deployment-1", kind: "container" },
      "/api/catalog/deployments/deployment-1/runtimes?kind=container",
    ],
    [
      "runtimes_get",
      { runtimeId: "runtime-1" },
      "/api/catalog/runtimes/runtime-1",
    ],
  ];
  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    assert.deepEqual(
      calls.map(({ url }) => new URL(url).pathname + new URL(url).search),
      cases.map(([, , expected]) => expected),
    );
    assert.equal(
      calls.every(({ options }) => options.method === undefined),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.ISSUE_API_URL;
    else process.env.ISSUE_API_URL = originalBaseUrl;
  }
});

test("catalog write tools use POST/PATCH and keep scope ids out of payloads", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.ISSUE_API_URL;
  const originalApiKey = process.env.ISSUE_API_KEY;
  process.env.ISSUE_API_URL = "http://api.test";
  process.env.ISSUE_API_KEY = "biaws_test_key";
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse();
  };
  const cases = [
    [
      "applications_create",
      { workspaceId: "ws-1", key: "app", name: "App" },
      "POST",
      "/api/catalog/workspaces/ws-1/applications",
      "workspaceId",
    ],
    [
      "applications_update",
      { applicationId: "app-1", name: "App 2" },
      "PATCH",
      "/api/catalog/applications/app-1",
      "applicationId",
    ],
    [
      "components_create",
      { applicationId: "app-1", key: "api", name: "API" },
      "POST",
      "/api/catalog/applications/app-1/components",
      "applicationId",
    ],
    [
      "components_update",
      { componentId: "component-1", name: "API 2" },
      "PATCH",
      "/api/catalog/components/component-1",
      "componentId",
    ],
    [
      "integrations_create",
      {
        applicationId: "app-1",
        key: "customer",
        name: "Customer",
        targetApplicationId: "app-2",
      },
      "POST",
      "/api/catalog/applications/app-1/integrations",
      "applicationId",
    ],
    [
      "integrations_update",
      { integrationId: "integration-1", name: "Customer API" },
      "PATCH",
      "/api/catalog/integrations/integration-1",
      "integrationId",
    ],
    [
      "repositories_create",
      {
        applicationId: "app-1",
        key: "repo",
        name: "Repo",
        url: "https://example.test/repo",
      },
      "POST",
      "/api/catalog/applications/app-1/repositories",
      "applicationId",
    ],
    [
      "repositories_update",
      { repositoryId: "repository-1", defaultBranch: "main" },
      "PATCH",
      "/api/catalog/repositories/repository-1",
      "repositoryId",
    ],
    [
      "servers_create",
      { workspaceId: "ws-1", key: "server", name: "Server" },
      "POST",
      "/api/catalog/workspaces/ws-1/servers",
      "workspaceId",
    ],
    [
      "servers_update",
      { serverId: "server-1", status: "maintenance" },
      "PATCH",
      "/api/catalog/servers/server-1",
      "serverId",
    ],
    [
      "deployments_create",
      {
        applicationId: "app-1",
        key: "prod",
        name: "Prod",
        componentId: "component-1",
      },
      "POST",
      "/api/catalog/applications/app-1/deployments",
      "applicationId",
    ],
    [
      "deployments_update",
      { deploymentId: "deployment-1", version: "2.0.0" },
      "PATCH",
      "/api/catalog/deployments/deployment-1",
      "deploymentId",
    ],
    [
      "runtimes_create",
      { deploymentId: "deployment-1", key: "runtime", name: "Runtime" },
      "POST",
      "/api/catalog/deployments/deployment-1/runtimes",
      "deploymentId",
    ],
    [
      "runtimes_update",
      { runtimeId: "runtime-1", status: "healthy", serverId: null },
      "PATCH",
      "/api/catalog/runtimes/runtime-1",
      "runtimeId",
    ],
  ];
  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      const [, , method, expectedPath, scopeField] = cases[index];
      assert.equal(call.options.method, method);
      assert.equal(new URL(call.url).pathname, expectedPath);
      assert.equal(call.options.headers.Authorization, "Bearer biaws_test_key");
      assert.equal(
        Object.hasOwn(JSON.parse(call.options.body), scopeField),
        false,
      );
    });
    assert.equal(JSON.parse(calls.at(-1).options.body).serverId, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.ISSUE_API_URL;
    else process.env.ISSUE_API_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.ISSUE_API_KEY;
    else process.env.ISSUE_API_KEY = originalApiKey;
  }
});

test("catalog schemas expose no credential or remote execution argument", () => {
  const prohibited = new Set([
    "password",
    "secret",
    "token",
    "credential",
    "privateKey",
    "kubeconfig",
    "connectionString",
    "command",
    "shell",
    "ssh",
    "mongoQuery",
  ]);
  function visit(schema) {
    for (const [key, value] of Object.entries(schema?.properties || {})) {
      assert.equal(prohibited.has(key), false, key);
      visit(value);
      visit(value?.items);
    }
  }
  catalogTools.forEach(({ inputSchema }) => visit(inputSchema));
});
