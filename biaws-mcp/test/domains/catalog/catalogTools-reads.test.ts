import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { jsonResponse } from "./catalogTools.fixtures.js";
test("catalog read tools dispatch only to their scoped HTTP endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const calls: { url: string; options: RequestInit }[] = [];
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
  ] as const;
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
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
