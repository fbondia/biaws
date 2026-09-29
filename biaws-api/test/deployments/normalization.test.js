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

test("deployment keeps its component immutable and validates source shape", () => {
  const current = normalizeDeploymentInput({
    key: "billing-production",
    name: "Billing production",
    componentId: "component-1",
    environment: "production",
    source: { repositoryId: "repository-1", revision: "abc123" },
  });
  assert.throws(
    () => normalizeDeploymentInput({ componentId: "component-2" }, current),
    (error) =>
      error.statusCode === 409 &&
      error.code === "DEPLOYMENT_COMPONENT_IMMUTABLE",
  );
  assert.throws(
    () =>
      normalizeDeploymentInput({
        key: "invalid",
        name: "Invalid",
        componentId: "component-1",
        source: { revision: "abc123" },
      }),
    (error) =>
      error.statusCode === 422 && error.code === "INVALID_DEPLOYMENT_SOURCE",
  );
});

test("deployment publications are append-only and materialize the latest release", () => {
  const deployment = normalizeDeploymentInput(
    {
      key: "billing-production",
      name: "Billing production",
      componentId: "component-1",
      environment: "production",
      repositoryId: "repository-1",
      publications: [
        {
          version: "2.4.0",
          revision: "abc123",
          status: "deployed",
          publishedAt: "2026-07-30T12:00:00.000Z",
          description: "Novo cálculo de cobrança",
        },
      ],
    },
    null,
    { userId: "user-1" },
  );
  assert.equal(deployment.publications.length, 1);
  assert.equal(deployment.publications[0].recordedBy, "user-1");
  assert.equal(deployment.publications[0].status, "deployed");
  assert.equal(deployment.version, "2.4.0");
  assert.equal(deployment.source.revision, "abc123");
  assert.equal(deployment.source.repositoryId, "repository-1");
  assert.equal(deployment.deployedAt.toISOString(), "2026-07-30T12:00:00.000Z");
  assert.throws(
    () =>
      normalizeDeploymentInput(
        { publications: [] },
        { ...deployment, id: "deployment-1" },
      ),
    (error) =>
      error.statusCode === 409 && error.code === "CATALOG_HISTORY_IMMUTABLE",
  );
});

test("deployment publication status is validated and can be updated", () => {
  const deployment = normalizeDeploymentInput(
    {
      key: "billing-production",
      name: "Billing production",
      componentId: "component-1",
      publications: [{ version: "2.5.0", status: "planned" }],
    },
    null,
    { userId: "user-1" },
  );
  assert.equal(deployment.publications[0].status, "planned");
  assert.equal(deployment.version, "");
  assert.equal(deployment.deployedAt, null);

  const deployed = normalizeDeploymentInput(
    {
      publications: deployment.publications.map((publication) => ({
        ...publication,
        status: "deployed",
      })),
    },
    { ...deployment, id: "deployment-1" },
    { userId: "user-2" },
  );
  assert.equal(deployed.publications[0].status, "deployed");
  assert.equal(deployed.version, "2.5.0");

  const canceled = normalizeDeploymentInput(
    {
      publications: deployed.publications.map((publication) => ({
        ...publication,
        status: "canceled",
      })),
    },
    { ...deployed, id: "deployment-1" },
  );
  assert.equal(canceled.version, "");
  assert.equal(canceled.deployedAt, null);

  assert.throws(
    () =>
      normalizeDeploymentInput(
        {
          publications: deployment.publications.map((publication) => ({
            ...publication,
            status: "unknown",
          })),
        },
        { ...deployment, id: "deployment-1" },
      ),
    (error) => error.statusCode === 422,
  );
});
