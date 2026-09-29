import { errorCode, errorStatusCode } from "../../src/helpers/error.js";
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

test("component relationships are normalized and duplicate references are rejected", () => {
  assert.deepEqual(
    normalizeComponentInput({
      key: " Billing-API ",
      name: " Billing API ",
      type: "api",
      repositoryLinks: [{ repositoryId: "repository-1", role: "source" }],
      dependencies: [
        {
          componentId: "component-2",
          kind: "http",
          description: " Customer API ",
        },
      ],
      tags: ["Backend", "backend"],
    }),
    {
      key: "billing-api",
      name: "Billing API",
      description: "",
      type: "api",
      repositoryLinks: [{ repositoryId: "repository-1", role: "source" }],
      dependencies: [
        {
          componentId: "component-2",
          kind: "http",
          description: "Customer API",
        },
      ],
      tags: ["Backend"],
    },
  );

  assert.throws(
    () =>
      normalizeComponentInput({
        key: "api",
        name: "API",
        repositoryLinks: [
          { repositoryId: "repository-1", role: "source" },
          { repositoryId: "repository-1", role: "documentation" },
        ],
      }),
    (error) =>
      errorStatusCode(error) === 422 &&
      errorCode(error) === "INVALID_COMPONENT_RELATIONSHIP",
  );
});
