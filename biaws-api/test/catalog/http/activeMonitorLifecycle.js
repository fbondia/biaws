import assert from "node:assert/strict";

export async function activeMonitorLifecycle(scenarioContext) {
  const { request, adminCookie, application, deployment, runtime } =
    scenarioContext;
  const templateDefinition = {
    rules: [
      {
        label: "HTTP 200",
        match: "all",
        conditions: [
          {
            path: "evidence.response.status",
            operator: "equals",
            value: 200,
          },
        ],
        result: {
          status: "healthy",
          message: "HTTP {{evidence.response.status}}",
          metadata: { evaluated_by: "template" },
        },
      },
    ],
    defaultResult: {
      status: "unavailable",
      message: "Unexpected response",
      metadata: {},
    },
  };

  const templateCreateResponse = await request("/api/monitoring/templates", {
    cookie: adminCookie,
    method: "POST",
    body: {
      name: "REST health",
      description: "Integration template",
      definition: templateDefinition,
    },
    origin: true,
  });

  assert.equal(templateCreateResponse.status, 201);

  const template = (await templateCreateResponse.json()).template;

  assert.equal(template.status, "draft");

  const templatePreviewResponse = await request(
    "/api/monitoring/templates/preview",
    {
      cookie: adminCookie,
      method: "POST",
      body: {
        definition: templateDefinition,
        sample: {
          evidence: { response: { status: 200 } },
          metadata: {},
          context: { provider: "rest" },
        },
      },
      origin: true,
    },
  );

  assert.equal(templatePreviewResponse.status, 200);

  assert.equal(
    (await templatePreviewResponse.json()).preview.result.status,
    "healthy",
  );

  const templateActivateResponse = await request(
    `/api/monitoring/templates/${template.id}/versions/${template.version}/activate`,
    { cookie: adminCookie, method: "POST", body: {}, origin: true },
  );

  assert.equal(templateActivateResponse.status, 200);

  const activeMonitorResponse = await request(
    `/api/monitoring/runtimes/${runtime.id}/active-monitors`,
    {
      cookie: adminCookie,
      method: "POST",
      body: {
        name: "Billing health",
        provider: "rest",
        intervalSeconds: 60,
        timeoutSeconds: 10,
        configuration: {
          target: "https://billing-http.example.test/health",
          expectedStatus: 200,
        },
        templateRef: { id: template.id, version: template.version },
      },
      origin: true,
    },
  );

  assert.equal(activeMonitorResponse.status, 201);

  const activeMonitor = (await activeMonitorResponse.json()).monitor;

  assert.equal(activeMonitor.runtimeId, runtime.id);

  assert.equal(activeMonitor.version, 1);

  const monitoredTopologyResponse = await request(
    "/api/monitoring/runtime-topology",
    { cookie: adminCookie },
  );

  assert.equal(monitoredTopologyResponse.status, 200);

  const monitoredTopology = (await monitoredTopologyResponse.json()).topology;

  assert.ok(monitoredTopology.applicationIds.includes(application.id));

  assert.ok(monitoredTopology.deploymentIds.includes(deployment.id));

  assert.ok(monitoredTopology.runtimeIds.includes(runtime.id));

  const monitoredTargetsResponse = await request(
    "/api/monitoring/runtime-targets",
    { cookie: adminCookie },
  );

  assert.equal(monitoredTargetsResponse.status, 200);

  const monitoredTarget = (await monitoredTargetsResponse.json()).items[0];

  assert.equal(monitoredTarget.id, runtime.id);

  assert.equal(monitoredTarget.application.id, application.id);

  assert.equal(monitoredTarget.deployment.id, deployment.id);

  assert.equal(monitoredTarget.monitorCount, 1);

  assert.equal(monitoredTarget.enabledMonitorCount, 1);

  assert.deepEqual(monitoredTarget.monitorNames, ["Billing health"]);

  const panelPreferenceResponse = await request(
    "/api/preferences/monitoring-panel",
    {
      cookie: adminCookie,
      method: "PUT",
      body: {
        widgets: [{ runtimeId: runtime.id, size: "large" }],
      },
      origin: true,
    },
  );

  assert.equal(panelPreferenceResponse.status, 200);

  assert.deepEqual((await panelPreferenceResponse.json()).runtimeIds, [
    runtime.id,
  ]);

  const savedPanelPreference = await (
    await request("/api/preferences/monitoring-panel", {
      cookie: adminCookie,
    })
  ).json();

  assert.deepEqual(savedPanelPreference.runtimeIds, [runtime.id]);

  assert.deepEqual(savedPanelPreference.widgets, [
    { runtimeId: runtime.id, size: "large" },
  ]);

  const activeMonitorList = await (
    await request(`/api/monitoring/runtimes/${runtime.id}/active-monitors`, {
      cookie: adminCookie,
    })
  ).json();

  assert.equal(activeMonitorList.meta.total, 1);

  assert.equal(activeMonitorList.items[0].id, activeMonitor.id);

  const leaseResponse = await request("/api/monitoring/executor/leases", {
    cookie: adminCookie,
    method: "POST",
    body: { executorId: "integration-runner", leaseSeconds: 60 },
    origin: true,
  });

  assert.equal(leaseResponse.status, 200);

  const lease = (await leaseResponse.json()).items[0];

  assert.equal(lease.id, activeMonitor.id);

  assert.ok(lease.leaseToken);

  const renewResponse = await request(
    `/api/monitoring/executor/leases/${lease.leaseToken}/renew`,
    {
      cookie: adminCookie,
      method: "POST",
      body: { executorId: "integration-runner", leaseSeconds: 60 },
      origin: true,
    },
  );

  assert.equal(renewResponse.status, 200);

  const activeResultResponse = await request(
    `/api/monitoring/executor/leases/${lease.leaseToken}/results`,
    {
      cookie: adminCookie,
      method: "POST",
      body: {
        executorId: "integration-runner",
        status: "healthy",
        observedAt: "2026-07-30T12:00:00.000Z",
        source: "active-rest",
        metadata: { duration_ms: 25 },
        payload: { response: { status: 200 } },
      },
      origin: true,
    },
  );

  assert.equal(activeResultResponse.status, 201);

  const activeResult = await activeResultResponse.json();

  assert.equal(activeResult.signal.origin, "active");

  assert.equal(activeResult.signal.monitorId, activeMonitor.id);

  assert.equal(activeResult.signal.executionId, lease.executionId);

  assert.equal(activeResult.signal.status, "healthy");

  assert.equal(activeResult.signal.message, "HTTP 200");

  assert.deepEqual(activeResult.signal.templateRef, {
    id: template.id,
    version: template.version,
  });

  assert.equal(activeResult.signal.templateSnapshot.name, "REST health");

  const duplicateActiveResult = await request(
    `/api/monitoring/executor/leases/${lease.leaseToken}/results`,
    {
      cookie: adminCookie,
      method: "POST",
      body: {
        executorId: "integration-runner",
        status: "healthy",
        source: "active-rest",
      },
      origin: true,
    },
  );

  assert.equal(duplicateActiveResult.status, 200);

  assert.equal((await duplicateActiveResult.json()).created, false);
  return {
    ...scenarioContext,
    templateDefinition,
    templateCreateResponse,
    template,
    templatePreviewResponse,
    templateActivateResponse,
    activeMonitorResponse,
    activeMonitor,
    monitoredTopologyResponse,
    monitoredTopology,
    monitoredTargetsResponse,
    monitoredTarget,
    panelPreferenceResponse,
    savedPanelPreference,
    activeMonitorList,
    leaseResponse,
    lease,
    renewResponse,
    activeResultResponse,
    activeResult,
    duplicateActiveResult,
  };
}
