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

test("repository URL rejects credentials and secret query parameters", () => {
  for (const url of [
    "https://user:password@example.test/repository.git",
    "https://example.test/repository.git?access_token=secret",
  ]) {
    assert.throws(
      () =>
        normalizeRepositoryInput({
          key: "repository",
          name: "Repository",
          url,
        }),
      (error) =>
        errorStatusCode(error) === 422 &&
        errorCode(error) === "INVALID_CATALOG_URL",
    );
  }
});

test("repository URL and identifier are mutable", () => {
  const current = normalizeRepositoryInput({
    key: "repository",
    name: "Repository",
    provider: "github",
    url: "https://example.test/old.git",
  });
  assert.equal(
    normalizeRepositoryInput({ url: "https://example.test/new.git" }, current)
      .url,
    "https://example.test/new.git",
  );
  assert.equal(
    normalizeRepositoryInput({ key: "new-key" }, current).key,
    "new-key",
  );
});
