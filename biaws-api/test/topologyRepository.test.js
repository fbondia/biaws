import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION_CATALOG } from "../../shared/index.js";
import { normalizeComponentInput } from "../src/repositories/componentsRepository.js";
import {
  normalizeDeploymentInput,
  normalizeRuntimeInput,
} from "../src/repositories/deploymentsRepository.js";
import { normalizeRepositoryInput } from "../src/repositories/repositoriesRepository.js";
import { normalizeServerInput } from "../src/repositories/serversRepository.js";
import {
  monitoringMetadataPresentation,
  monitoringMetadataProfileCatalog,
} from "../src/repositories/monitoringMetadataProfiles.js";
import {
  normalizeActiveMonitorInput,
  normalizeActiveMonitorLeaseRequest,
} from "../src/repositories/runtimeActiveMonitoringModel.js";
import {
  buildRuntimeMonitoringSignalFilter,
  monitoringExpirationDate,
  normalizeManualMonitoringObservation,
  normalizeMonitoringPayload,
  normalizeMonitoringSignal,
} from "../src/repositories/runtimeMonitoringRepository.js";
import {
  buildRuntimeMonitoringSummaryPipeline,
  normalizeRuntimeMonitoringSummaryQuery,
  runtimeMonitoringSummaryResponse,
} from "../src/repositories/runtimeMonitoringSummary.js";
import {
  buildScopedListFilter,
  pagination,
} from "../src/repositories/topologyRepositorySupport.js";

test("topology permissions are part of the canonical catalog", () => {
  const permissions = new Set(PERMISSION_CATALOG.map(({ id }) => id));
  for (const domain of [
    "components",
    "integrations",
    "repositories",
    "servers",
    "deployments",
    "runtimes",
  ]) {
    for (const operation of ["read", "create", "update", "archive"]) {
      assert.equal(permissions.has(`${domain}.${operation}`), true);
    }
  }
  assert.equal(permissions.has("monitoring.active.execute"), true);
  assert.equal(permissions.has("monitoring.active.request"), true);
});

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
      error.statusCode === 422 &&
      error.code === "INVALID_COMPONENT_RELATIONSHIP",
  );
});

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
        error.statusCode === 422 && error.code === "INVALID_CATALOG_URL",
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
    (error) =>
      error.statusCode === 422 && error.code === "INVALID_RUNTIME_METADATA",
  );
  assert.throws(
    () =>
      normalizeRuntimeInput({
        key: "pod-1",
        name: "Pod 1",
        metadata: { nested: { value: true } },
      }),
    (error) =>
      error.statusCode === 422 && error.code === "INVALID_RUNTIME_METADATA",
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
    (error) => error.code === "INVALID_RUNTIME_DOCUMENTS",
  );
  assert.throws(
    () =>
      normalizeRuntimeInput(
        { observations: [] },
        { ...runtime, id: "runtime-1" },
      ),
    (error) => error.code === "INVALID_CATALOG_PAYLOAD",
  );
  assert.throws(
    () =>
      normalizeRuntimeInput({
        key: "pod-2",
        name: "Pod 2",
        monitoringRetentionDays: 3651,
      }),
    (error) => error.code === "INVALID_MONITORING_RETENTION",
  );
});

test("active monitor configuration is bounded and secret-free", () => {
  const monitor = normalizeActiveMonitorInput({
    name: " Billing health ",
    provider: "rest",
    enabled: true,
    intervalSeconds: 60,
    timeoutSeconds: 10,
    configuration: {
      target: "https://billing.example.test/health",
      expectedStatus: 200,
    },
    templateRef: { id: "template-1", version: "v1" },
  });
  assert.equal(monitor.name, "Billing health");
  assert.equal(monitor.nameKey, "billing health");
  assert.equal(monitor.provider, "rest");
  assert.equal(monitor.intervalSeconds, 60);
  assert.deepEqual(monitor.templateRef, { id: "template-1", version: "v1" });
  assert.throws(
    () =>
      normalizeActiveMonitorInput({
        name: "Unsafe",
        provider: "rest",
        configuration: { authorization: "Bearer secret" },
      }),
    (error) => error.code === "INVALID_MONITORING_PAYLOAD",
  );
  assert.throws(
    () =>
      normalizeActiveMonitorInput({
        name: "Too frequent",
        provider: "shell",
        intervalSeconds: 5,
      }),
    (error) => error.code === "INVALID_ACTIVE_MONITOR",
  );
  assert.throws(
    () =>
      normalizeActiveMonitorInput({
        name: "Timeout exceeds interval",
        provider: "rest",
        intervalSeconds: 30,
        timeoutSeconds: 31,
      }),
    (error) => error.code === "INVALID_ACTIVE_MONITOR",
  );
  const shell = normalizeActiveMonitorInput({
    name: "Worker health",
    provider: "shell",
    configuration: { scriptId: "worker-health" },
  });
  assert.deepEqual(shell.configuration, {
    scriptId: "worker-health",
    failureStatus: "unavailable",
    captureOutput: "none",
  });
  assert.throws(
    () =>
      normalizeActiveMonitorInput({
        name: "Templated shell",
        provider: "shell",
        configuration: { scriptId: "worker-health" },
        templateRef: { id: "health", version: "1" },
      }),
    (error) => error.code === "SHELL_TEMPLATE_NOT_SUPPORTED",
  );
  assert.throws(
    () =>
      normalizeActiveMonitorInput({
        name: "Invalid shell capture",
        provider: "shell",
        configuration: {
          scriptId: "worker-health",
          captureOutput: "everything",
        },
      }),
    (error) => error.code === "INVALID_CATALOG_PAYLOAD",
  );
});

test("active monitor lease requests require a bounded executor identity", () => {
  assert.deepEqual(
    normalizeActiveMonitorLeaseRequest({ executorId: "runner-1" }),
    { executorId: "runner-1", limit: 1, leaseSeconds: 60 },
  );
  assert.throws(
    () =>
      normalizeActiveMonitorLeaseRequest({
        executorId: "runner-1",
        limit: 26,
      }),
    (error) => error.code === "INVALID_ACTIVE_MONITOR",
  );
});

test("monitoring signals validate status, idempotency key and secret-free metadata", () => {
  const signal = normalizeMonitoringSignal(
    {
      signalId: "zabbix:billing-api:42",
      status: "degraded",
      observedAt: "2026-07-31T15:00:00.000Z",
      source: "zabbix",
      message: "Latência acima do limite",
      metadata: { latency_ms: 850 },
      payload: {
        http: { status: 503, timings: [35, 42] },
        checks: [{ name: "database", healthy: false }],
      },
    },
    { userId: "monitor-1" },
  );
  assert.equal(signal.signalId, "zabbix:billing-api:42");
  assert.equal(signal.status, "degraded");
  assert.equal(signal.recordedBy, "monitor-1");
  assert.equal(signal.payload.http.status, 503);
  assert.equal(signal.observedAt.toISOString(), "2026-07-31T15:00:00.000Z");
  assert.throws(
    () =>
      normalizeMonitoringSignal({
        status: "healthy",
        source: "agent",
        metadata: { apiToken: "secret" },
      }),
    (error) => error.code === "INVALID_RUNTIME_METADATA",
  );
  assert.throws(
    () =>
      normalizeMonitoringSignal({
        signalId: "contains spaces",
        status: "healthy",
        source: "agent",
      }),
    (error) => error.code === "INVALID_MONITORING_SIGNAL",
  );
});

test("monitoring metadata profiles validate their versioned field contract", () => {
  const catalog = monitoringMetadataProfileCatalog();
  assert.deepEqual(
    catalog.map(({ id }) => id),
    ["sgmp-health/v1", "sgmp-api-health/v1"],
  );
  assert.equal(catalog[0].label, "Saúde do SGMP");
  assert.equal(catalog[1].fields[2].key, "connection_pool_up");

  const signal = normalizeMonitoringSignal({
    status: "healthy",
    source: "sgmp-health-monitor",
    metadataProfile: "sgmp-health/v1",
    metadata: {
      service_up: true,
      database_up: true,
      disk_usage_percent: 72.35,
      error_history_dates: ["2026-08-01", "2026-08-02"],
      error_history_values: [10, 12],
      error_history_unit: "bytes",
    },
  });
  assert.equal(signal.metadataProfile, "sgmp-health/v1");
  const presentation = monitoringMetadataPresentation(signal.metadataProfile);
  assert.equal(presentation.fields[2].format, "percent");
  assert.equal(presentation.series[0].visualization, "line");

  const apiSignal = normalizeMonitoringSignal({
    status: "healthy",
    source: "sgmp-health-monitor",
    metadataProfile: "sgmp-api-health/v1",
    metadata: {
      service_up: true,
      database_up: true,
      connection_pool_up: true,
      database_response_time_ms: 31,
      pool_active_connections: 12,
      pool_idle_connections: 8,
      pool_total_connections: 20,
      pool_awaiting_threads: 0,
      pool_maximum_size: 20,
      pool_minimum_idle: 2,
      pool_utilization_percent: 60,
    },
  });
  const apiPresentation = monitoringMetadataPresentation(
    apiSignal.metadataProfile,
  );
  assert.equal(apiPresentation.label, "Saúde da API de Automações");
  assert.equal(apiPresentation.fields[2].key, "connection_pool_up");
  assert.equal(apiPresentation.fields[4].visualization, "gauge");

  assert.throws(
    () =>
      normalizeMonitoringSignal({
        status: "degraded",
        source: "monitor",
        metadataProfile: "sgmp-api-health/v1",
        metadata: {
          service_up: false,
          pool_awaiting_threads: -1,
        },
      }),
    (error) => error.code === "INVALID_MONITORING_METADATA_PROFILE",
  );

  assert.throws(
    () =>
      normalizeMonitoringSignal({
        status: "healthy",
        source: "monitor",
        metadataProfile: "sgmp-health/v1",
        metadata: { service_up: true, disk_usage_percent: 101 },
      }),
    (error) => error.code === "INVALID_MONITORING_METADATA_PROFILE",
  );
  assert.throws(
    () =>
      normalizeMonitoringSignal({
        status: "healthy",
        source: "monitor",
        metadataProfile: "unknown/v1",
        metadata: { service_up: true },
      }),
    (error) => error.code === "INVALID_MONITORING_METADATA_PROFILE",
  );
});

test("monitoring payload accepts bounded nested JSON and rejects sensitive keys", () => {
  assert.deepEqual(
    normalizeMonitoringPayload({
      response: {
        status: 200,
        headers: ["content-type"],
        dailyCounts: { "2026-08-12": 4 },
      },
    }),
    {
      response: {
        status: 200,
        headers: ["content-type"],
        dailyCounts: { "2026-08-12": 4 },
      },
    },
  );
  assert.throws(
    () => normalizeMonitoringPayload({ request: { authorization: "value" } }),
    (error) => error.code === "INVALID_MONITORING_PAYLOAD",
  );
  assert.throws(
    () => normalizeMonitoringPayload({ constructor: "unexpected" }),
    (error) => error.code === "INVALID_MONITORING_PAYLOAD",
  );
  assert.throws(
    () => normalizeMonitoringPayload({ values: Array(101).fill(1) }),
    (error) => error.code === "INVALID_MONITORING_PAYLOAD",
  );
});

test("monitoring expiration follows runtime retention and supports no expiration", () => {
  assert.equal(
    monitoringExpirationDate("2026-08-01T00:00:00.000Z", 10).toISOString(),
    "2026-08-11T00:00:00.000Z",
  );
  assert.equal(monitoringExpirationDate(new Date(), 0), null);
});

test("manual monitoring observations use the unified event contract", () => {
  const observation = normalizeManualMonitoringObservation(
    {
      status: "degraded",
      observedAt: "2026-08-01T12:00:00.000Z",
      message: "Confirmado pelo operador",
      metadata: { ticket: "INC-42" },
    },
    { userId: "operator-1" },
  );
  assert.equal(observation.source, "Registro manual");
  assert.equal(observation.signalId, null);
  assert.equal(observation.payload, null);
  assert.equal(observation.recordedBy, "operator-1");
});

test("monitoring signal history filters status and observed date range", () => {
  const filter = buildRuntimeMonitoringSignalFilter(
    { id: "runtime-1", workspaceId: "workspace-1" },
    {
      status: "degraded",
      observedFrom: "2026-07-01",
      observedTo: "2026-07-31",
    },
  );
  assert.equal(filter.status, "degraded");
  assert.equal(
    filter.observedAt.$gte.toISOString(),
    "2026-07-01T00:00:00.000Z",
  );
  assert.equal(filter.observedAt.$lt.toISOString(), "2026-08-01T00:00:00.000Z");
  const instantFilter = buildRuntimeMonitoringSignalFilter(
    { id: "runtime-1", workspaceId: "workspace-1" },
    {
      observedFrom: "2026-07-31T10:15:00-03:00",
      observedTo: "2026-07-31T12:45:00-03:00",
    },
  );
  assert.equal(
    instantFilter.observedAt.$gte.toISOString(),
    "2026-07-31T13:15:00.000Z",
  );
  assert.equal(
    instantFilter.observedAt.$lte.toISOString(),
    "2026-07-31T15:45:00.000Z",
  );
  assert.throws(
    () =>
      buildRuntimeMonitoringSignalFilter(
        { id: "runtime-1", workspaceId: "workspace-1" },
        { status: "invalid" },
      ),
    (error) => error.statusCode === 422,
  );
  assert.throws(
    () =>
      buildRuntimeMonitoringSignalFilter(
        { id: "runtime-1", workspaceId: "workspace-1" },
        { observedFrom: "2026-08-02", observedTo: "2026-08-01" },
      ),
    (error) => error.code === "INVALID_MONITORING_FILTER",
  );
});

test("monitoring health summary bounds long ranges with an effective resolution", () => {
  const settings = normalizeRuntimeMonitoringSummaryQuery(
    {
      maxPoints: 100,
      observedFrom: "2026-01-01",
      observedTo: "2026-06-30",
      resolution: "1m",
    },
    new Date("2026-07-01T00:00:00.000Z"),
  );
  assert.equal(settings.observedFrom.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(settings.observedTo.toISOString(), "2026-06-30T23:59:59.999Z");
  assert.equal(settings.requestedResolution, "1m");
  assert.equal(settings.resolution.id, "7d");
  assert.throws(
    () => normalizeRuntimeMonitoringSummaryQuery({ maxPoints: 10 }),
    (error) => error.code === "INVALID_MONITORING_SUMMARY",
  );
});

test("monitoring health summary pipeline keeps the worst state in each bucket", () => {
  const settings = normalizeRuntimeMonitoringSummaryQuery({
    maxPoints: 400,
    observedFrom: "2026-08-01T00:00:00.000Z",
    observedTo: "2026-08-01T12:00:00.000Z",
    resolution: "1h",
  });
  const pipeline = buildRuntimeMonitoringSummaryPipeline(
    { runtimeId: "runtime-1", workspaceId: "workspace-1" },
    settings,
  );
  const group = pipeline.find((stage) => stage.$group).$group;
  assert.deepEqual(group.worstSeverity, { $min: "$severity" });
  assert.equal(group._id.bucket.$dateTrunc.unit, "hour");
  assert.equal(group._id.bucket.$dateTrunc.binSize, 1);
});

test("monitoring health summary returns compact series and aggregate counts", () => {
  const settings = normalizeRuntimeMonitoringSummaryQuery({
    observedFrom: "2026-08-01",
    observedTo: "2026-08-02",
    resolution: "1h",
  });
  const summary = runtimeMonitoringSummaryResponse(
    { id: "runtime-1" },
    settings,
    [
      {
        _id: {
          bucket: new Date("2026-08-01T10:00:00.000Z"),
          seriesId: "monitor:http",
        },
        degradedCount: 1,
        eventCount: 8,
        healthyCount: 7,
        label: "HTTP",
        monitorId: "http",
        stoppedCount: 0,
        unavailableCount: 0,
        unknownCount: 0,
        worstSeverity: 2,
      },
    ],
  );
  assert.equal(summary.meta.eventCount, 8);
  assert.equal(summary.meta.pointCount, 1);
  assert.equal(summary.meta.statusCounts.healthy, 7);
  assert.deepEqual(summary.series[0], {
    id: "monitor:http",
    label: "HTTP",
    monitorId: "http",
    points: [
      {
        eventCount: 8,
        observedAt: "2026-08-01T10:00:00.000Z",
        observedTo: "2026-08-01T10:59:59.999Z",
        status: "degraded",
        statusCounts: {
          stopped: 0,
          unavailable: 0,
          degraded: 1,
          unknown: 0,
          healthy: 7,
        },
      },
    ],
  });
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
  assert.equal(filter.$or[0].key.test("api.*"), true);
  assert.equal(filter.$or[0].key.test("api-anything"), false);
  assert.deepEqual(pagination({ page: "2", limit: "500" }), {
    page: 2,
    limit: 100,
    skip: 100,
  });
  assert.throws(
    () => pagination({ page: "0" }),
    (error) =>
      error.statusCode === 422 && error.code === "INVALID_CATALOG_PAGINATION",
  );
});
