import assert from "node:assert/strict";

export async function overview(scenarioContext) {
  const { server, request, adminCookie, mutate, application, topologyServer, deployment, runtime } = scenarioContext;
  const applicationHealthResponse = await request(`/api/monitoring/applications/${application.id}/health`, {
    cookie: adminCookie,
  });

  assert.equal(applicationHealthResponse.status, 200);

  const applicationHealth = await applicationHealthResponse.json();

  assert.equal(applicationHealth.health.status, "degraded");

  assert.equal(applicationHealth.health.total, 1);

  assert.equal(applicationHealth.health.observed, 1);

  assert.equal(applicationHealth.health.details.kind, "health");

  assert.equal(applicationHealth.health.details.items.length, 1);

  assert.equal(
    applicationHealth.health.details.items[0].components[0].deployments[0].runtimes[0].latestSignal.metadata
      .disk_usage_percent,
    85,
  );

  await mutate(`/api/catalog/deployments/${deployment.id}/runtimes`, {
    key: "without-monitoring",
    name: "Runtime without monitoring",
    kind: "container",
    status: "unknown",
  });

  const homeResponse = await request("/api/home", {
    cookie: adminCookie,
  });

  assert.equal(homeResponse.status, 200);

  const home = await homeResponse.json();

  assert.equal(home.catalog.length, 5);

  assert.equal(home.configuration.customized, false);

  const homeMonitoringRuntime =
    home.data["default-application-health-6"].items[0].components[0].deployments[0].runtimes[0];

  assert.equal(homeMonitoringRuntime.latestSignal.metadata.disk_usage_percent, 85);

  assert.equal(homeMonitoringRuntime.latestSignal.metadataPresentation.series[0].visualization, "line");

  const homeMonitoringResponse = await request("/api/home/monitoring", {
    cookie: adminCookie,
  });

  assert.equal(homeMonitoringResponse.status, 200);

  const homeMonitoring = await homeMonitoringResponse.json();

  assert.deepEqual(Object.keys(homeMonitoring.data), ["default-application-health-6"]);

  assert.equal(
    homeMonitoring.data["default-application-health-6"].items[0].components[0].deployments[0].runtimes[0].latestSignal
      .metadata.disk_usage_percent,
    85,
  );

  const invalidHomeResponse = await request("/api/home/configuration", {
    cookie: adminCookie,
    method: "PUT",
    body: {
      widgets: [
        {
          id: "missing-health",
          widgetId: "application-health",
          size: "medium",
          config: { applicationId: "missing-application" },
        },
      ],
    },
    origin: true,
  });

  assert.equal(invalidHomeResponse.status, 422);

  const configuredHomeResponse = await request("/api/home/configuration", {
    cookie: adminCookie,
    method: "PUT",
    body: {
      widgets: [
        {
          id: "billing-health",
          widgetId: "application-health",
          size: "medium",
          config: {
            applicationId: application.id,
            environment: "production",
          },
        },
      ],
    },
    origin: true,
  });

  assert.equal(configuredHomeResponse.status, 200);

  const configuredHome = await configuredHomeResponse.json();

  assert.equal(configuredHome.configuration.customized, true);

  assert.equal(configuredHome.configuration.widgets[0].config.environment, "production");

  const billingHealth = configuredHome.data["billing-health"];

  assert.equal(billingHealth.kind, "health");

  assert.equal(billingHealth.applicationId, application.id);

  assert.equal(billingHealth.environment, "production");

  assert.equal(billingHealth.items.length, 1);

  assert.equal(billingHealth.items[0].name, application.name);

  assert.equal(billingHealth.items[0].components[0].deployments[0].runtimes[0].server.name, topologyServer.name);

  const { diagram } = await mutate(`/api/catalog/applications/${application.id}/topology-diagrams`, {
    name: "Produção principal",
    environment: "production",
    nodes: [
      {
        id: `server:${topologyServer.id}`,
        position: { x: 100, y: 200 },
      },
    ],
    edges: [],
    comments: "Topologia HTTP",
  });

  const diagramListResponse = await request(`/api/catalog/applications/${application.id}/topology-diagrams`, {
    cookie: adminCookie,
  });

  assert.equal(diagramListResponse.status, 200);

  assert.equal((await diagramListResponse.json()).items[0].id, diagram.id);

  const diagramUpdateResponse = await request(`/api/catalog/topology-diagrams/${diagram.id}`, {
    cookie: adminCookie,
    method: "PATCH",
    body: { comments: "Topologia HTTP revisada" },
    origin: true,
  });

  assert.equal(diagramUpdateResponse.status, 200);

  assert.equal((await diagramUpdateResponse.json()).diagram.comments, "Topologia HTTP revisada");

  const contextResponse = await request(`/api/catalog/applications/${application.id}/context?limit=10`, {
    cookie: adminCookie,
  });

  assert.equal(contextResponse.status, 200);

  const context = await contextResponse.json();

  assert.equal(context.runtimes[0].id, runtime.id);

  assert.equal(Object.hasOwn(context.servers[0], "hostname"), false);

  const conflict = await request(`/api/catalog/servers/${topologyServer.id}/archive`, {
    cookie: adminCookie,
    method: "PATCH",
    body: {},
    origin: true,
  });

  assert.equal(conflict.status, 409);

  assert.equal((await conflict.json()).error.code, "SERVER_IN_USE");

  const unsafeRepository = await request(`/api/catalog/applications/${application.id}/repositories`, {
    cookie: adminCookie,
    method: "POST",
    body: {
      key: "unsafe",
      name: "Unsafe",
      url: "https://example.test/repo.git?token=secret",
    },
    origin: true,
  });

  assert.equal(unsafeRepository.status, 422);
  return {
    ...scenarioContext,
    applicationHealthResponse,
    applicationHealth,
    homeResponse,
    home,
    homeMonitoringRuntime,
    homeMonitoringResponse,
    homeMonitoring,
    invalidHomeResponse,
    configuredHomeResponse,
    configuredHome,
    billingHealth,
    diagram,
    diagramListResponse,
    diagramUpdateResponse,
    contextResponse,
    context,
    conflict,
    unsafeRepository,
  };
}
