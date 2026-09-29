import { errorCode, errorStatusCode } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION_CATALOG } from "../../../shared/index.js";
import { normalizeComponentInput } from "../../src/repositories/components/index.js";
import { normalizeDeploymentInput, normalizeRuntimeInput } from "../../src/repositories/deployments/index.js";
import { normalizeRepositoryInput } from "../../src/repositories/repositories/index.js";
import { normalizeServerInput } from "../../src/repositories/servers/index.js";
import {
  monitoringMetadataPresentation,
  monitoringMetadataProfileCatalog,
} from "../../src/repositories/monitoring/metadataProfiles/model.js";
import {
  normalizeActiveMonitorInput,
  normalizeActiveMonitorLeaseRequest,
} from "../../src/repositories/monitoring/activeMonitors/input.js";
import {
  buildRuntimeMonitoringSignalFilter,
  monitoringExpirationDate,
  normalizeManualMonitoringObservation,
  normalizeMonitoringPayload,
  normalizeMonitoringSignal,
} from "../../src/repositories/monitoring/events/index.js";
import {
  buildRuntimeMonitoringSummaryPipeline,
  normalizeRuntimeMonitoringSummaryQuery,
  runtimeMonitoringSummaryResponse,
} from "../../src/repositories/monitoring/events/summary.js";
import { buildScopedListFilter, pagination } from "../../src/repositories/shared/topology/index.js";

test("topology permissions are part of the canonical catalog", () => {
  const permissions = new Set(PERMISSION_CATALOG.map(({ id }) => id));
  for (const domain of ["components", "integrations", "repositories", "servers", "deployments", "runtimes"]) {
    for (const operation of ["read", "create", "update", "archive"]) {
      assert.equal(permissions.has(`${domain}.${operation}`), true);
    }
  }
  assert.equal(permissions.has("monitoring.active.execute"), true);
  assert.equal(permissions.has("monitoring.active.request"), true);
});

test("scoped topology filters escape search and pagination is bounded", () => {
  const filter = buildScopedListFilter({
    workspaceId: "workspace-1",
    applicationId: "application-1",
    statuses: ["active", "archived"],
    query: { q: "api.*" },
  });
  assert.equal(filter.workspaceId, "workspace-1");
  assert.equal(filter.applicationId, "application-1");
  assert.equal(filter.status, "active");
  const keyPattern = filter.$or?.[0]?.key;
  assert.ok(keyPattern);
  assert.equal(keyPattern.test("api.*"), true);
  assert.equal(keyPattern.test("api-anything"), false);
  assert.deepEqual(pagination({ page: "2", limit: "500" }), {
    page: 2,
    limit: 100,
    skip: 100,
  });
  assert.throws(
    () => pagination({ page: "0" }),
    (error) => errorStatusCode(error) === 422 && errorCode(error) === "INVALID_CATALOG_PAGINATION",
  );
});
