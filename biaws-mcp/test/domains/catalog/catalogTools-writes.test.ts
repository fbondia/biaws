import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { jsonResponse } from "./catalogTools.fixtures.js";
test("catalog write tools use POST/PATCH and keep scope ids out of payloads", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  const originalApiKey = process.env.BIAWS_API_KEY;
  process.env.BIAWS_API_URL = "http://api.test";
  process.env.BIAWS_API_KEY = "biaws_test_key";
  const calls: { url: string; options: RequestInit }[] = [];
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
      "deployments_record_publication",
      {
        deploymentId: "deployment-1",
        version: "2.0.0",
        revision: "abc123",
        status: "deployed",
      },
      "POST",
      "/api/catalog/deployments/deployment-1/publications",
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
  ] as const;
  try {
    for (const [name, args] of cases) await dispatchTool(name, args);
    calls.forEach((call, index) => {
      const [, , method, expectedPath, scopeField] = cases[index];
      assert.equal(call.options.method, method);
      assert.equal(new URL(call.url).pathname, expectedPath);
      assert.equal(
        new Headers(call.options.headers).get("Authorization"),
        "Bearer biaws_test_key",
      );
      assert.equal(
        Object.hasOwn(JSON.parse(String(call.options.body)), scopeField),
        false,
      );
    });
    assert.equal(
      JSON.parse(String(required(calls.at(-1)).options.body)).serverId,
      null,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.BIAWS_API_KEY;
    else process.env.BIAWS_API_KEY = originalApiKey;
  }
});
