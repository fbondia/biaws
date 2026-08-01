import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

const integrationEnabled =
  Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI) &&
  process.env.BIAWS_HTTP_INTEGRATION === "1";

test(
  "topology HTTP API enforces authentication, permissions, relations and audit",
  { skip: !integrationEnabled },
  async () => {
    const port = Number(process.env.BIAWS_HTTP_INTEGRATION_PORT || 37_129);
    const baseUrl = `http://127.0.0.1:${port}`;
    const issueDirectory = await mkdtemp(
      path.join(tmpdir(), "biaws-phase2-http-"),
    );
    Object.assign(process.env, {
      MONGO_URI: process.env.BIAWS_INTEGRATION_MONGO_URI,
      MONGO_DB:
        process.env.BIAWS_HTTP_INTEGRATION_MONGO_DB ||
        "biaws_topology_http_integration",
      BETTER_AUTH_SECRET:
        "phase2-integration-secret-with-more-than-32-characters",
      BETTER_AUTH_URL: baseUrl,
      BETTER_AUTH_TRUSTED_ORIGINS: baseUrl,
      ISSUE_API_HOST: "127.0.0.1",
      ISSUE_API_PORT: String(port),
      ISSUE_DIR: issueDirectory,
      ATTACHMENT_STORAGE_LOCAL_DIR: issueDirectory,
    });

    const { createApp } = await import("../src/app.js");
    const { getAuth } = await import("../src/auth/auth.js");
    const { bootstrapAdmin } = await import("../src/auth/bootstrapAdmin.js");
    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const { setUserGroups } =
      await import("../src/repositories/accessRepository.js");
    const { ensureDefaultWorkspace } =
      await import("../src/repositories/catalogRepository.js");

    const database = await getMongoDatabase();
    await database.dropDatabase();
    const auth = await getAuth();
    const password = "Phase2-integration-password";
    const admin = await bootstrapAdmin({
      auth,
      database,
      email: "admin.phase2@example.test",
      password,
      name: "Phase 2 administrator",
      log() {},
      assignAdministration: (userId) =>
        setUserGroups(userId, ["administration"], { userId }),
    });
    await ensureDefaultWorkspace({ userId: admin.user.id });
    const reader = await auth.api.createUser({
      body: {
        email: "reader.phase2@example.test",
        password,
        name: "Phase 2 reader",
        role: "user",
      },
    });
    await setUserGroups(reader.user.id, ["support"], { userId: admin.user.id });
    await database
      .collection(COLLECTION_NAMES.PERMISSION_GROUPS)
      .updateOne(
        { _id: "administration" },
        { $pull: { permissions: "runtimes.read" } },
      );

    const server = createApp().listen(port, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    async function login(email) {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl,
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    }

    async function request(
      route,
      {
        apiKey,
        cookie,
        method = "GET",
        body,
        origin = false,
        workspaceId,
      } = {},
    ) {
      return fetch(`${baseUrl}${route}`, {
        method,
        headers: {
          "x-forwarded-for": "127.0.0.1",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          ...(cookie ? { cookie } : {}),
          ...(origin ? { origin: baseUrl } : {}),
          ...(workspaceId ? { "x-biaws-workspace-id": workspaceId } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }

    try {
      assert.equal((await request("/api/catalog/workspaces")).status, 401);
      const readerCookie = await login("reader.phase2@example.test");
      assert.equal(
        (await request("/api/catalog/workspaces", { cookie: readerCookie }))
          .status,
        403,
      );
      assert.equal(
        (
          await database
            .collection(COLLECTION_NAMES.PERMISSION_GROUPS)
            .findOne({
              _id: "administration",
            })
        ).permissions.includes("runtimes.read"),
        true,
      );

      const adminCookie = await login("admin.phase2@example.test");
      const workspaceResponse = await request("/api/catalog/workspaces", {
        cookie: adminCookie,
      });
      assert.equal(workspaceResponse.status, 200);
      const workspace = (await workspaceResponse.json()).items[0];
      const createdApiKey = await auth.api.createApiKey({
        body: {
          name: "Phase 2 integration",
          userId: admin.user.id,
        },
      });
      assert.equal(
        await database
          .collection(COLLECTION_NAMES.AUTH_API_KEYS)
          .countDocuments({
            referenceId: admin.user.id,
          }),
        1,
      );
      assert.equal(
        (
          await request("/api/catalog/workspaces", {
            apiKey: createdApiKey.key,
            workspaceId: workspace.id,
          })
        ).status,
        200,
      );

      async function mutate(route, body, expectedStatus = 201) {
        const response = await request(route, {
          cookie: adminCookie,
          method: "POST",
          body,
          origin: true,
        });
        if (response.status !== expectedStatus) {
          throw new Error(
            `Expected ${expectedStatus} from ${route}, received ${response.status}: ${await response.text()}`,
          );
        }
        return response.json();
      }

      async function patch(route, body) {
        const response = await request(route, {
          cookie: adminCookie,
          method: "PATCH",
          body,
          origin: true,
        });
        if (response.status !== 200) {
          throw new Error(
            `Expected 200 from ${route}, received ${response.status}: ${await response.text()}`,
          );
        }
        return response.json();
      }

      const { application } = await mutate(
        `/api/catalog/workspaces/${workspace.id}/applications`,
        { key: "billing-http", name: "Billing HTTP" },
      );
      const { repository } = await mutate(
        `/api/catalog/applications/${application.id}/repositories`,
        {
          key: "billing-http-repository",
          name: "Billing HTTP repository",
          provider: "github",
          url: "https://example.test/billing-http.git",
        },
      );
      const { component } = await mutate(
        `/api/catalog/applications/${application.id}/components`,
        {
          key: "billing-http-api",
          name: "Billing HTTP API",
          type: "api",
          repositoryLinks: [{ repositoryId: repository.id, role: "source" }],
        },
      );
      const { server: topologyServer } = await mutate(
        `/api/catalog/workspaces/${workspace.id}/servers`,
        {
          key: "billing-http-server",
          name: "Billing HTTP server",
          hostname: "billing.internal.example.test",
        },
      );
      const { deployment } = await mutate(
        `/api/catalog/applications/${application.id}/deployments`,
        {
          key: "billing-http-production",
          name: "Billing HTTP production",
          componentId: component.id,
          environment: "production",
          source: { repositoryId: repository.id, revision: "abc123" },
          status: "active",
        },
      );
      const { runtime } = await mutate(
        `/api/catalog/deployments/${deployment.id}/runtimes`,
        {
          key: "billing-http-runtime",
          name: "Billing HTTP runtime",
          kind: "container",
          serverId: topologyServer.id,
          endpoint: "https://billing-http.example.test",
          status: "healthy",
        },
      );
      const updatedApplication = (
        await patch(`/api/catalog/applications/${application.id}`, {
          key: "billing-service",
        })
      ).application;
      const updatedComponent = (
        await patch(`/api/catalog/components/${component.id}`, {
          key: "billing-api",
        })
      ).component;
      const updatedDeployment = (
        await patch(`/api/catalog/deployments/${deployment.id}`, {
          key: "production",
        })
      ).deployment;
      const updatedRuntime = (
        await patch(`/api/catalog/runtimes/${runtime.id}`, {
          key: "primary",
        })
      ).runtime;
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
          metadata: { latency_ms: 850 },
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
      const runtimePath = [
        updatedApplication.key,
        updatedComponent.key,
        updatedDeployment.key,
        updatedRuntime.key,
      ].join(".");
      const oldSignalResponse = await request(
        `/api/monitoring/runtimes/${runtimePath}/signals`,
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            signalId: "monitor:event:1",
            status: "healthy",
            observedAt: "2026-07-31T14:00:00.000Z",
            source: "integration-monitor",
          },
          origin: true,
        },
      );
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
      const filteredSignalsResponse = await request(
        `${signalRoute}?status=healthy&observedFrom=2026-07-31&observedTo=2026-07-31`,
        { cookie: adminCookie },
      );
      assert.equal(filteredSignalsResponse.status, 200);
      const filteredSignals = await filteredSignalsResponse.json();
      assert.equal(filteredSignals.meta.total, 1);
      assert.equal(filteredSignals.items[0].signalId, "monitor:event:1");
      const manualObservationResponse = await request(
        `/api/monitoring/runtimes/${runtime.id}/manual-observations`,
        {
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
        },
      );
      assert.equal(manualObservationResponse.status, 201);
      const manualObservation = await manualObservationResponse.json();
      assert.equal(manualObservation.signal.origin, "manual");
      assert.ok(manualObservation.signal.expiresAt);
      const timelineResponse = await request(
        `/api/monitoring/runtimes/${runtime.id}/timeline?limit=10`,
        { cookie: adminCookie },
      );
      assert.equal(timelineResponse.status, 200);
      const timeline = await timelineResponse.json();
      assert.equal(timeline.meta.total, 3);
      assert.equal(timeline.items[0].origin, "manual");
      assert.equal(timeline.items[1].origin, "external");
      assert.equal(timeline.items[1].payload.probe.durationMs, 850);
      const retentionUpdate = await patch(
        `/api/catalog/runtimes/${runtime.id}`,
        { monitoringRetentionDays: 20 },
      );
      assert.equal(retentionUpdate.runtime.monitoringRetentionDays, 20);
      const retainedTimeline = await (
        await request(`/api/monitoring/runtimes/${runtime.id}/timeline`, {
          cookie: adminCookie,
        })
      ).json();
      for (const event of retainedTimeline.items) {
        assert.equal(
          new Date(event.expiresAt) - new Date(event.receivedAt),
          20 * 86_400_000,
        );
      }
      const expirationIndex = (
        await database
          .collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS)
          .indexes()
      ).find(({ name }) => name === "monitoring_expiration");
      assert.equal(expirationIndex.expireAfterSeconds, 0);
      const applicationHealthResponse = await request(
        `/api/monitoring/applications/${application.id}/health`,
        { cookie: adminCookie },
      );
      assert.equal(applicationHealthResponse.status, 200);
      const applicationHealth = await applicationHealthResponse.json();
      assert.equal(applicationHealth.health.status, "degraded");
      assert.equal(applicationHealth.health.total, 1);
      assert.equal(applicationHealth.health.observed, 1);
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
      assert.equal(
        configuredHome.configuration.widgets[0].config.environment,
        "production",
      );
      assert.equal(configuredHome.data["billing-health"].nok, 1);
      assert.equal(configuredHome.data["billing-health"].total, 1);
      assert.equal(
        configuredHome.data["billing-health"].items[0].name,
        application.name,
      );
      assert.equal(
        configuredHome.data["billing-health"].items[0].components[0]
          .deployments[0].runtimes[0].server.name,
        topologyServer.name,
      );
      const { diagram } = await mutate(
        `/api/catalog/applications/${application.id}/topology-diagrams`,
        {
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
        },
      );
      const diagramListResponse = await request(
        `/api/catalog/applications/${application.id}/topology-diagrams`,
        { cookie: adminCookie },
      );
      assert.equal(diagramListResponse.status, 200);
      assert.equal((await diagramListResponse.json()).items[0].id, diagram.id);
      const diagramUpdateResponse = await request(
        `/api/catalog/topology-diagrams/${diagram.id}`,
        {
          cookie: adminCookie,
          method: "PATCH",
          body: { comments: "Topologia HTTP revisada" },
          origin: true,
        },
      );
      assert.equal(diagramUpdateResponse.status, 200);
      assert.equal(
        (await diagramUpdateResponse.json()).diagram.comments,
        "Topologia HTTP revisada",
      );

      const contextResponse = await request(
        `/api/catalog/applications/${application.id}/context?limit=10`,
        { cookie: adminCookie },
      );
      assert.equal(contextResponse.status, 200);
      const context = await contextResponse.json();
      assert.equal(context.runtimes[0].id, runtime.id);
      assert.equal(Object.hasOwn(context.servers[0], "hostname"), false);

      const conflict = await request(
        `/api/catalog/servers/${topologyServer.id}/archive`,
        {
          cookie: adminCookie,
          method: "PATCH",
          body: {},
          origin: true,
        },
      );
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).error.code, "SERVER_IN_USE");

      const unsafeRepository = await request(
        `/api/catalog/applications/${application.id}/repositories`,
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            key: "unsafe",
            name: "Unsafe",
            url: "https://example.test/repo.git?token=secret",
          },
          origin: true,
        },
      );
      assert.equal(unsafeRepository.status, 422);

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
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await database.dropDatabase();
      await closeMongoClient();
      await rm(issueDirectory, { recursive: true, force: true });
    }
  },
);
