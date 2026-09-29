import assert from "node:assert/strict";
import { COLLECTION_NAMES } from "../../../src/database/collectionNames.js";

export async function legacyShell(scenarioContext) {
  const { database, request, adminCookie, runtime, template } = scenarioContext;
  await database
    .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
    .insertOne({
      id: "legacy-shell-monitor",
      workspaceId: runtime.workspaceId,
      applicationId: runtime.applicationId,
      deploymentId: runtime.deploymentId,
      runtimeId: runtime.id,
      name: "Legacy shell monitor",
      nameKey: "legacy shell monitor",
      description: "Legacy compatibility fixture",
      provider: "shell",
      enabled: true,
      intervalSeconds: 60,
      timeoutSeconds: 10,
      configuration: { scriptId: "worker-health" },
      templateRef: { id: template.id, version: template.version },
      nextRunAt: new Date(0),
      version: 1,
      createdAt: new Date(),
      createdBy: "integration-test",
      updatedAt: new Date(),
      updatedBy: "integration-test",
    });

  const legacyShellLeaseResponse = await request(
    "/api/monitoring/executor/leases",
    {
      cookie: adminCookie,
      method: "POST",
      body: { executorId: "integration-runner", leaseSeconds: 60 },
      origin: true,
    },
  );

  assert.equal(legacyShellLeaseResponse.status, 200);

  const legacyShellLease = (await legacyShellLeaseResponse.json()).items[0];

  assert.equal(legacyShellLease.id, "legacy-shell-monitor");

  assert.equal(legacyShellLease.templateRef, undefined);

  const legacyShellResultResponse = await request(
    `/api/monitoring/executor/leases/${legacyShellLease.leaseToken}/results`,
    {
      cookie: adminCookie,
      method: "POST",
      body: {
        executorId: "integration-runner",
        status: "degraded",
        source: "active-shell",
        metadata: { exit_code: 7, shell_stderr: "limited failure" },
        payload: { raw: "must not be persisted" },
      },
      origin: true,
    },
  );

  assert.equal(legacyShellResultResponse.status, 201);

  const legacyShellResult = await legacyShellResultResponse.json();

  assert.equal(legacyShellResult.signal.status, "degraded");

  assert.equal(legacyShellResult.signal.metadata.exit_code, 7);

  assert.equal(legacyShellResult.signal.payload, undefined);

  assert.equal(legacyShellResult.signal.templateRef, undefined);

  const auditResponse = await request(`/api/audit/runtime/${runtime.id}`, {
    cookie: adminCookie,
  });

  assert.equal(auditResponse.status, 200);

  const audit = await auditResponse.json();

  assert.ok(audit.events.length >= 5);

  assert.ok(
    audit.events.some(
      ({ action }) => action === "monitoring_observation_recorded",
    ),
  );

  assert.equal(audit.events.at(-1).action, "created");

  assert.equal(audit.events[0].target.id, runtime.id);
  return {
    ...scenarioContext,
    legacyShellLeaseResponse,
    legacyShellLease,
    legacyShellResultResponse,
    legacyShellResult,
    auditResponse,
    audit,
  };
}
