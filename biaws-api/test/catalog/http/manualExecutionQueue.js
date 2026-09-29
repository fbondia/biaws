import assert from "node:assert/strict";
import { COLLECTION_NAMES } from "../../../src/database/collectionNames.js";

export async function manualExecutionQueue(scenarioContext) {
  const {
    database,
    request,
    readerCookie,
    adminCookie,
    application,
    runtime,
    activeMonitor,
  } = scenarioContext;
  const monitorBeforeManualRequest = await database
    .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
    .findOne({ id: activeMonitor.id });

  const manualExecutionRoute = `/api/monitoring/runtimes/${runtime.id}/active-monitors/${activeMonitor.id}/executions`;

  const unauthorizedManualExecution = await request(manualExecutionRoute, {
    cookie: readerCookie,
    method: "POST",
    body: {},
    origin: true,
  });

  assert.equal(unauthorizedManualExecution.status, 403);

  const manualExecutionResponse = await request(manualExecutionRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {},
    origin: true,
  });

  assert.equal(manualExecutionResponse.status, 202);

  const manualExecution = await manualExecutionResponse.json();

  assert.equal(manualExecution.created, true);

  assert.equal(manualExecution.execution.trigger, "manual");

  const duplicateManualExecutionResponse = await request(manualExecutionRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {},
    origin: true,
  });

  assert.equal(duplicateManualExecutionResponse.status, 200);

  const duplicateManualExecution =
    await duplicateManualExecutionResponse.json();

  assert.equal(duplicateManualExecution.created, false);

  assert.equal(
    duplicateManualExecution.execution.id,
    manualExecution.execution.id,
  );

  const monitorsWithQueuedExecution = await (
    await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(
    monitorsWithQueuedExecution.items[0].pendingExecution.status,
    "queued",
  );

  const homeWithQueuedExecution = await (
    await request("/api/home/monitoring", { cookie: adminCookie })
  ).json();

  assert.deepEqual(
    homeWithQueuedExecution.data["default-application-health-6"].items[0]
      .components[0].deployments[0].runtimes[0].pendingExecutions,
    [
      {
        id: manualExecution.execution.id,
        runtimeId: runtime.id,
        status: "queued",
      },
    ],
  );

  const manualLeaseResponse = await request("/api/monitoring/executor/leases", {
    cookie: adminCookie,
    method: "POST",
    body: { executorId: "integration-runner", leaseSeconds: 60 },
    origin: true,
  });

  assert.equal(manualLeaseResponse.status, 200);

  const manualLease = (await manualLeaseResponse.json()).items[0];

  assert.equal(manualLease.id, activeMonitor.id);

  assert.equal(manualLease.executionId, manualExecution.execution.id);

  assert.equal(manualLease.trigger, "manual");

  const duplicateWhileRunningResponse = await request(manualExecutionRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {},
    origin: true,
  });

  assert.equal(duplicateWhileRunningResponse.status, 200);

  const duplicateWhileRunning = await duplicateWhileRunningResponse.json();

  assert.equal(duplicateWhileRunning.created, false);

  assert.equal(
    duplicateWhileRunning.execution.id,
    manualExecution.execution.id,
  );

  assert.equal(duplicateWhileRunning.execution.status, "running");

  const monitorsWithRunningExecution = await (
    await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(
    monitorsWithRunningExecution.items[0].pendingExecution.status,
    "running",
  );

  const monitorAfterManualLease = await database
    .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
    .findOne({ id: activeMonitor.id });

  assert.deepEqual(
    monitorAfterManualLease.nextRunAt,
    monitorBeforeManualRequest.nextRunAt,
  );

  const manualResultResponse = await request(
    `/api/monitoring/executor/leases/${manualLease.leaseToken}/results`,
    {
      cookie: adminCookie,
      method: "POST",
      body: {
        executorId: "integration-runner",
        status: "healthy",
        observedAt: "2026-07-30T12:05:00.000Z",
        source: "active-rest",
        payload: { response: { status: 200 } },
      },
      origin: true,
    },
  );

  assert.equal(manualResultResponse.status, 201);

  const manualResult = await manualResultResponse.json();

  assert.equal(manualResult.signal.executionId, manualExecution.execution.id);

  assert.equal(manualResult.signal.trigger, "manual");

  const monitorsAfterManualResult = await (
    await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(monitorsAfterManualResult.items[0].pendingExecution, undefined);

  const homeAfterManualResult = await (
    await request("/api/home/monitoring", { cookie: adminCookie })
  ).json();

  const homeRuntimeAfterManualResult =
    homeAfterManualResult.data["default-application-health-6"].items[0]
      .components[0].deployments[0].runtimes[0];

  assert.equal(
    homeRuntimeAfterManualResult.latestSignal.metadata.disk_usage_percent,
    85,
  );

  assert.deepEqual(homeRuntimeAfterManualResult.pendingExecutions, []);
  return {
    ...scenarioContext,
    monitorBeforeManualRequest,
    manualExecutionRoute,
    unauthorizedManualExecution,
    manualExecutionResponse,
    manualExecution,
    duplicateManualExecutionResponse,
    duplicateManualExecution,
    monitorsWithQueuedExecution,
    homeWithQueuedExecution,
    manualLeaseResponse,
    manualLease,
    duplicateWhileRunningResponse,
    duplicateWhileRunning,
    monitorsWithRunningExecution,
    monitorAfterManualLease,
    manualResultResponse,
    manualResult,
    monitorsAfterManualResult,
    homeAfterManualResult,
    homeRuntimeAfterManualResult,
  };
}
