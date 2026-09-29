import assert from "node:assert/strict";
import test from "node:test";
import { RESOURCE_CATALOG } from "../../biaws-mcp/src/resourceCatalog.js";
import { issuesRouter } from "../src/routes/issues/index.js";
import { requestsRouter } from "../src/routes/requests/index.js";
import { knowledgeRecordsRouter } from "../src/routes/knowledgeRecords/index.js";
import { catalogRouter } from "../src/routes/catalog/index.js";
import { catalogTopologyRouter } from "../src/routes/catalogTopology/index.js";
import { monitoringRouter } from "../src/routes/monitoring/index.js";
import { resourceCollectionsRouter } from "../src/routes/resourceCollections/index.js";
import { secretsRouter } from "../src/routes/secrets/index.js";
import { auditRouter } from "../src/routes/audit/index.js";

test("every advertised MCP resource has a GET route in the API", () => {
  const mounts = [
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
    router.stack
      .filter((layer) => layer.route?.methods.get)
      .map((layer) =>
        (base + layer.route.path).replace(/\/$/u, "").replace(/:\w+/gu, "{}"),
      ),
  );
  for (const resource of RESOURCE_CATALOG) {
    const path = resource.path.split("?")[0].replace(/\{\w+\}/gu, "{}");
    assert.ok(
      routes.includes(path),
      `${resource.uriTemplate} -> ${resource.path}`,
    );
  }
  assert.equal(
    new Set(RESOURCE_CATALOG.map((resource) => resource.uriTemplate)).size,
    RESOURCE_CATALOG.length,
  );
});
