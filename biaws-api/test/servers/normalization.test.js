import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION_CATALOG } from "../../../shared/index.js";
import { normalizeComponentInput } from "../../src/repositories/components/index.js";
import {
  normalizeDeploymentInput,
  normalizeRuntimeInput,
} from "../../src/repositories/deployments/index.js";
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
import {
  buildScopedListFilter,
  pagination,
} from "../../src/repositories/shared/topology/index.js";

test("server payload limits lifecycle changes and credential-bearing addresses", () => {
  assert.equal(
    normalizeServerInput({
      key: "api-prod-1",
      name: "API production 1",
      status: "maintenance",
      addresses: ["10.0.0.10", "https://api.example.test"],
    }).status,
    "maintenance",
  );
  assert.throws(
    () =>
      normalizeServerInput({
        key: "api-prod-1",
        name: "API production 1",
        status: "archived",
      }),
    (error) => error.statusCode === 422,
  );
  assert.throws(
    () =>
      normalizeServerInput({
        key: "api-prod-1",
        name: "API production 1",
        addresses: ["https://user:secret@example.test"],
      }),
    (error) => error.statusCode === 422 && error.code === "INVALID_CATALOG_URL",
  );
});
