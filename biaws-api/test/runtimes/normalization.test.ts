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

test("runtime metadata is flat, bounded and rejects secret-like keys", () => {
  const runtime = normalizeRuntimeInput({
    key: "pod-1",
    name: "Pod 1",
    kind: "kubernetes",
    port: 8080,
    metadata: {
      cluster: "cluster-a",
      replicas: 2,
      zones: ["a", "b"],
    },
  });
  assert.deepEqual(runtime.metadata, {
    cluster: "cluster-a",
    replicas: 2,
    zones: ["a", "b"],
  });
  assert.throws(
    () =>
      normalizeRuntimeInput({
        key: "pod-1",
        name: "Pod 1",
        metadata: { apiToken: "secret" },
      }),
    (error) => errorStatusCode(error) === 422 && errorCode(error) === "INVALID_RUNTIME_METADATA",
  );
  assert.throws(
    () =>
      normalizeRuntimeInput({
        key: "pod-1",
        name: "Pod 1",
        metadata: { nested: { value: true } },
      }),
    (error) => errorStatusCode(error) === 422 && errorCode(error) === "INVALID_RUNTIME_METADATA",
  );
});

test("runtime defaults monitoring retention and rejects embedded observations", () => {
  const runtime = normalizeRuntimeInput(
    {
      key: "pod-1",
      name: "Pod 1",
      documentLinks: [
        { documentId: "document-1", purpose: "operation" },
        { documentId: "document-2", purpose: "rollback" },
      ],
      operationalNotesMarkdown: "# Publicação\n\n1. Atualize a imagem.",
    },
    null,
    { userId: "monitor-1" },
  );
  assert.equal(runtime.monitoringRetentionDays, 10);
  assert.deepEqual(runtime.documentLinks, [
    { documentId: "document-1", purpose: "operation" },
    { documentId: "document-2", purpose: "rollback" },
  ]);
  assert.match(runtime.operationalNotesMarkdown, /Atualize a imagem/u);
  assert.throws(
    () =>
      normalizeRuntimeInput({
        key: "pod-2",
        name: "Pod 2",
        documentLinks: [{ documentId: "document-1", purpose: "invalid" }],
      }),
    (error) => errorCode(error) === "INVALID_RUNTIME_DOCUMENTS",
  );
  assert.throws(
    () => normalizeRuntimeInput({ observations: [] }, { ...runtime, id: "runtime-1" }),
    (error) => errorCode(error) === "INVALID_CATALOG_PAYLOAD",
  );
  assert.throws(
    () =>
      normalizeRuntimeInput({
        key: "pod-2",
        name: "Pod 2",
        monitoringRetentionDays: 3651,
      }),
    (error) => errorCode(error) === "INVALID_MONITORING_RETENTION",
  );
});
