import assert from "node:assert/strict";
import { COLLECTION_NAMES } from "../../../src/database/collectionNames.js";
import {
  integratedMonitoringTemplateSeeds,
  migrateIntegratedMonitoringProfiles,
} from "../../../src/repositories/monitoring/metadataProfiles/templateSeeds.js";

export async function passiveSignals(scenarioContext) {
  const {
    database,
    request,
    adminCookie,
    patch,
    runtime,
    updatedApplication,
    updatedComponent,
    updatedDeployment,
    updatedRuntime,
  } = scenarioContext;
  const signalRoute = `/api/monitoring/runtimes/${runtime.id}/signals`;

  const signalResponse = await request(signalRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {
      signalId: "monitor:event:2",
      status: "degraded",
      observedAt: "2026-07-31T15:00:00.000Z",
      source: "integration-monitor",
      message: "Latency threshold exceeded",
      metadataProfile: "sgmp-health/v1",
      metadata: {
        service_up: true,
        database_up: true,
        disk_usage_percent: 85,
        error_history_dates: ["2026-07-30", "2026-07-31"],
        error_history_values: [420, 850],
        error_history_unit: "bytes",
      },
      payload: {
        probe: { statusCode: 503, durationMs: 850 },
        dependencies: [{ name: "database", healthy: false }],
      },
    },
    origin: true,
  });

  assert.equal(signalResponse.status, 201);

  assert.equal((await signalResponse.json()).runtime.status, "degraded");

  const duplicateSignalResponse = await request(signalRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {
      signalId: "monitor:event:2",
      status: "degraded",
      source: "integration-monitor",
    },
    origin: true,
  });

  assert.equal(duplicateSignalResponse.status, 200);

  assert.equal((await duplicateSignalResponse.json()).created, false);

  const runtimePath = [updatedApplication.key, updatedComponent.key, updatedDeployment.key, updatedRuntime.key].join(
    ".",
  );

  const oldSignalResponse = await request(`/api/monitoring/runtimes/${runtimePath}/signals`, {
    cookie: adminCookie,
    method: "POST",
    body: {
      signalId: "monitor:event:1",
      status: "healthy",
      observedAt: "2026-07-31T14:00:00.000Z",
      source: "integration-monitor",
    },
    origin: true,
  });

  assert.equal(oldSignalResponse.status, 201);

  assert.equal((await oldSignalResponse.json()).runtime.status, "degraded");

  const signalsResponse = await request(`${signalRoute}?limit=10`, {
    cookie: adminCookie,
  });

  assert.equal(signalsResponse.status, 200);

  const signals = await signalsResponse.json();

  assert.equal(signals.meta.total, 2);

  assert.equal(signals.items[0].signalId, "monitor:event:2");

  assert.equal(signals.items[0].payload.probe.statusCode, 503);

  assert.equal(signals.items[0].metadataProfile, "sgmp-health/v1");

  assert.equal(signals.items[0].metadataPresentation.fields[2].format, "percent");

  assert.equal(signals.items[0].metadataPresentation.series[0].visualization, "line");

  const profilesResponse = await request("/api/monitoring/metadata-profiles", {
    cookie: adminCookie,
  });

  assert.equal(profilesResponse.status, 200);

  const profiles = (await profilesResponse.json()).items;

  assert.deepEqual(
    profiles.map(({ id }) => id),
    ["sgmp-health/v1", "sgmp-api-health/v1"],
  );

  assert.equal(profiles[0].usage.observations, 1);

  assert.equal(profiles[0].usage.lastObservedAt, "2026-07-31T15:00:00.000Z");

  const profileMigration = await migrateIntegratedMonitoringProfiles(database, {
    apply: true,
  });

  const repeatedProfileMigration = await migrateIntegratedMonitoringProfiles(database, { apply: true });

  assert.equal(profileMigration.eligibleWorkspaces, 1);

  assert.equal(profileMigration.templatesCreated, 2);

  assert.equal(repeatedProfileMigration.templatesCreated, 0);

  assert.equal(repeatedProfileMigration.existingTemplates, 2);

  const migratedTemplates = await database
    .collection(COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES)
    .find({ workspaceId: runtime.workspaceId })
    .sort({ id: 1 })
    .toArray();

  assert.deepEqual(
    migratedTemplates.map(({ id, version, status }) => ({
      id,
      version,
      status,
    })),
    [
      { id: "sgmp-api-health", version: "1", status: "active" },
      { id: "sgmp-health", version: "1", status: "active" },
    ],
  );

  assert.equal(migratedTemplates[0].definition.schemaVersion, "1");

  assert.equal(migratedTemplates[0].definition.transformation.language, "jsonata");

  assert.equal(
    await database.collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS).countDocuments({
      workspaceId: runtime.workspaceId,
      metadataProfile: "sgmp-health/v1",
      templateRef: { $exists: false },
    }),
    1,
  );

  const filteredSignalsResponse = await request(
    `${signalRoute}?status=healthy&observedFrom=2026-07-31&observedTo=2026-07-31`,
    { cookie: adminCookie },
  );

  assert.equal(filteredSignalsResponse.status, 200);

  const filteredSignals = await filteredSignalsResponse.json();

  assert.equal(filteredSignals.meta.total, 1);

  assert.equal(filteredSignals.items[0].signalId, "monitor:event:1");

  const manualObservationResponse = await request(`/api/monitoring/runtimes/${runtime.id}/manual-observations`, {
    cookie: adminCookie,
    method: "POST",
    body: {
      status: "unavailable",
      observedAt: "2026-07-31T16:00:00.000Z",
      source: "operador",
      message: "Indisponibilidade confirmada manualmente",
      metadata: { ticket: "INC-42" },
    },
    origin: true,
  });

  assert.equal(manualObservationResponse.status, 201);

  const manualObservation = await manualObservationResponse.json();

  assert.equal(manualObservation.signal.origin, "manual");

  assert.ok(manualObservation.signal.expiresAt);

  const timelineResponse = await request(`/api/monitoring/runtimes/${runtime.id}/timeline?limit=10`, {
    cookie: adminCookie,
  });

  assert.equal(timelineResponse.status, 200);

  const timeline = await timelineResponse.json();

  assert.equal(timeline.meta.total, 3);

  assert.equal(timeline.items[0].origin, "manual");

  assert.equal(timeline.items[1].origin, "passive");

  assert.equal(timeline.items[1].payload.probe.durationMs, 850);

  const healthSummaryResponse = await request(
    `/api/monitoring/runtimes/${runtime.id}/health-summary?observedFrom=2026-07-31&observedTo=2026-07-31&resolution=1h&maxPoints=50`,
    { cookie: adminCookie },
  );

  assert.equal(healthSummaryResponse.status, 200);

  const healthSummary = await healthSummaryResponse.json();

  assert.equal(healthSummary.meta.eventCount, 3);

  assert.equal(healthSummary.meta.resolution, "1h");

  assert.equal(healthSummary.meta.statusCounts.unavailable, 1);

  assert.equal(
    healthSummary.series.some(({ id }) => id === "origin:manual"),
    true,
  );

  const retentionUpdate = await patch(`/api/catalog/runtimes/${runtime.id}`, {
    monitoringRetentionDays: 20,
  });

  assert.equal(retentionUpdate.runtime.monitoringRetentionDays, 20);

  const retainedTimeline = await (
    await request(`/api/monitoring/runtimes/${runtime.id}/timeline`, {
      cookie: adminCookie,
    })
  ).json();

  for (const event of retainedTimeline.items) {
    assert.equal(new Date(event.expiresAt) - new Date(event.receivedAt), 20 * 86_400_000);
  }
  return {
    ...scenarioContext,
    signalRoute,
    signalResponse,
    duplicateSignalResponse,
    runtimePath,
    oldSignalResponse,
    signalsResponse,
    signals,
    profilesResponse,
    profiles,
    profileMigration,
    repeatedProfileMigration,
    migratedTemplates,
    filteredSignalsResponse,
    filteredSignals,
    manualObservationResponse,
    manualObservation,
    timelineResponse,
    timeline,
    healthSummaryResponse,
    healthSummary,
    retentionUpdate,
    retainedTimeline,
  };
}
