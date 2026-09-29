import assert from "node:assert/strict";
import { COLLECTION_NAMES } from "../../../src/database/collectionNames.js";

export async function executionRecovery(scenarioContext) {
  const { database, request, adminCookie, runtime, timeline, template, activeMonitor, lease, secondManualExecution } =
    scenarioContext;
  await database.collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS).updateOne(
    { id: activeMonitor.id },
    {
      $set: {
        lease: {
          token: "expired-scheduled-lease",
          executionId: "expired-scheduled-execution",
          executorId: "previous-runner",
          scheduledFor: new Date("2026-07-30T11:00:00.000Z"),
          leasedAt: new Date("2026-07-30T11:00:00.000Z"),
          leasedUntil: new Date("2026-07-30T11:01:00.000Z"),
          trigger: "scheduled",
        },
      },
    },
  );

  const leaseAfterExpiredExecution = await request("/api/monitoring/executor/leases", {
    cookie: adminCookie,
    method: "POST",
    body: { executorId: "integration-runner", leaseSeconds: 60 },
    origin: true,
  });

  assert.equal(leaseAfterExpiredExecution.status, 200);

  const recoveredManualLease = (await leaseAfterExpiredExecution.json()).items[0];

  assert.equal(recoveredManualLease.executionId, secondManualExecution.execution.id);

  assert.equal(recoveredManualLease.trigger, "manual");

  const timelineAfterActive = await (
    await request(`/api/monitoring/runtimes/${runtime.id}/timeline`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(timelineAfterActive.items.filter(({ origin }) => origin === "active").length, 2);

  const templateUsage = await (
    await request(`/api/monitoring/templates/${template.id}/versions/${template.version}/usage`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(templateUsage.usage.activeMonitors, 1);

  assert.equal(templateUsage.usage.observations, 2);

  const templateDeleteResponse = await request(
    `/api/monitoring/templates/${template.id}/versions/${template.version}`,
    { cookie: adminCookie, method: "DELETE", origin: true },
  );

  assert.equal(templateDeleteResponse.status, 409);

  const activeMonitorIndexNames = (await database.collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS).indexes()).map(
    ({ name }) => name,
  );

  assert.ok(activeMonitorIndexNames.includes("runtime_active_monitor_catalog_filter"));

  const expirationIndex = (await database.collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS).indexes()).find(
    ({ name }) => name === "monitoring_expiration",
  );

  assert.equal(expirationIndex.expireAfterSeconds, 0);
  return {
    ...scenarioContext,
    leaseAfterExpiredExecution,
    recoveredManualLease,
    timelineAfterActive,
    templateUsage,
    templateDeleteResponse,
    activeMonitorIndexNames,
    expirationIndex,
  };
}
