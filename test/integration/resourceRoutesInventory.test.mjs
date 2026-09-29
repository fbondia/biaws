import assert from "node:assert/strict";
import test from "node:test";
import { RESOURCE_CATALOG } from "../../biaws-mcp/dist/src/mcp/resources/resourceCatalog.js";
import { issuesRouter } from "../../biaws-api/src/routes/issues/index.js";
import { requestsRouter } from "../../biaws-api/src/routes/requests/index.js";
import { knowledgeRecordsRouter } from "../../biaws-api/src/routes/knowledgeRecords/index.js";
import { catalogRouter } from "../../biaws-api/src/routes/catalog/index.js";
import { catalogTopologyRouter } from "../../biaws-api/src/routes/catalogTopology/index.js";
import { monitoringRouter } from "../../biaws-api/src/routes/monitoring/index.js";
import { resourceCollectionsRouter } from "../../biaws-api/src/routes/resourceCollections/index.js";
import { secretsRouter } from "../../biaws-api/src/routes/secrets/index.js";
import { auditRouter } from "../../biaws-api/src/routes/audit/index.js";

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
});
