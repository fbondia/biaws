import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Router } from "express";

import { WORKSPACE_ROOT } from "../../src/helpers/runtimePaths.js";
import { issuesRouter } from "../../src/routes/issues/index.js";
import { requestsRouter } from "../../src/routes/requests/index.js";
import { knowledgeRecordsRouter } from "../../src/routes/knowledgeRecords/index.js";
import { catalogRouter } from "../../src/routes/catalog/index.js";
import { catalogTopologyRouter } from "../../src/routes/catalogTopology/index.js";
import { monitoringRouter } from "../../src/routes/monitoring/index.js";
import { resourceCollectionsRouter } from "../../src/routes/resourceCollections/index.js";
import { secretsRouter } from "../../src/routes/secrets/index.js";
import { auditRouter } from "../../src/routes/audit/index.js";

interface ResourceDefinition {
  uriTemplate: string;
  path: string;
}
interface RouteLayer {
  route?: { methods: Record<string, boolean>; path: string };
}

function isResourceDefinition(value: unknown): value is ResourceDefinition {
  return (
    value !== null &&
    typeof value === "object" &&
    "uriTemplate" in value &&
    typeof value.uriTemplate === "string" &&
    "path" in value &&
    typeof value.path === "string"
  );
}

test("every advertised MCP resource has a GET route in the API", () => {
  const catalogPath = path.join(WORKSPACE_ROOT, "biaws-mcp", "src", "mcp", "resources", "resourceCatalog.json");
  const catalog: unknown = JSON.parse(readFileSync(catalogPath, "utf8"));
  assert.ok(Array.isArray(catalog) && catalog.every(isResourceDefinition));
  const resources: ResourceDefinition[] = catalog;
  const mounts: Array<[string, Router]> = [
    ["/api/issues", issuesRouter],
    ["/api/requests", requestsRouter],
    ["/api/knowledge", knowledgeRecordsRouter],
    ["/api/catalog", catalogRouter],
    ["/api/catalog", catalogTopologyRouter],
    ["/api/monitoring", monitoringRouter],
    ["/api/resource-collections", resourceCollectionsRouter],
    ["/api/secrets", secretsRouter],
    ["/api/audit", auditRouter],
  ];
  const routes = mounts.flatMap(([base, router]) =>
    (router.stack as unknown as RouteLayer[])
      .filter((layer) => layer.route?.methods.get)
      .map((layer) => (base + layer.route!.path).replace(/\/$/u, "").replace(/:\w+/gu, "{}")),
  );
  for (const resource of resources) {
    const resourcePath = resource.path.split("?")[0].replace(/\{\w+\}/gu, "{}");
    assert.ok(routes.includes(resourcePath), `${resource.uriTemplate} -> ${resource.path}`);
  }
  assert.equal(new Set(resources.map((resource) => resource.uriTemplate)).size, resources.length);
});
