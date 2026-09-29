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
