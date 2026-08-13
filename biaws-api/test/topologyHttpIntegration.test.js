import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { COLLECTION_NAMES } from "../src/database/collectionNames.js";
import {
  integratedMonitoringTemplateSeeds,
  migrateIntegratedMonitoringProfiles,
} from "../src/repositories/monitoringMetadataProfileTemplates.js";

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
          await request("/api/monitoring/executor/leases", {
            cookie: readerCookie,
            method: "POST",
            body: { executorId: "unauthorized-runner" },
            origin: true,
          })
        ).status,
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
        false,
      );
      await database
        .collection(COLLECTION_NAMES.PERMISSION_GROUPS)
        .updateOne(
          { _id: "administration" },
          { $addToSet: { permissions: "runtimes.read" } },
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
      assert.equal(signals.items[0].metadataProfile, "sgmp-health/v1");
      assert.equal(
        signals.items[0].metadataPresentation.fields[2].format,
        "percent",
      );
      assert.equal(
        signals.items[0].metadataPresentation.series[0].visualization,
        "line",
      );
      const profilesResponse = await request(
        "/api/monitoring/metadata-profiles",
        { cookie: adminCookie },
      );
      assert.equal(profilesResponse.status, 200);
      const profiles = (await profilesResponse.json()).items;
      assert.deepEqual(
        profiles.map(({ id }) => id),
        ["sgmp-health/v1", "sgmp-api-health/v1"],
      );
      assert.equal(profiles[0].usage.observations, 1);
      assert.equal(
        profiles[0].usage.lastObservedAt,
        "2026-07-31T15:00:00.000Z",
      );
      const profileMigration = await migrateIntegratedMonitoringProfiles(
        database,
        { apply: true },
      );
      const repeatedProfileMigration =
        await migrateIntegratedMonitoringProfiles(database, { apply: true });
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
      assert.equal(
        migratedTemplates[0].definition.transformation.language,
        "jsonata",
      );
      assert.equal(
        await database
          .collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS)
          .countDocuments({
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
      assert.equal(timeline.items[1].origin, "passive");
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
      const invalidMonitorResponse = await request(
        `/api/monitoring/runtimes/${runtime.id}/active-monitors`,
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            name: "Unsafe active monitor",
            provider: "rest",
            intervalSeconds: 30,
            timeoutSeconds: 31,
            configuration: {},
          },
          origin: true,
        },
      );
      assert.equal(invalidMonitorResponse.status, 422);
      await database
        .collection(COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES)
        .insertOne({
          id: "foreign-template",
          version: "v1",
          workspaceId: "other-workspace",
          status: "active",
        });
      const foreignTemplateResponse = await request(
        `/api/monitoring/runtimes/${runtime.id}/active-monitors`,
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            name: "Foreign template",
            provider: "rest",
            configuration: {},
            templateRef: { id: "foreign-template", version: "v1" },
          },
          origin: true,
        },
      );
      assert.equal(foreignTemplateResponse.status, 422);
      assert.equal(
        (await foreignTemplateResponse.json()).error.code,
        "INVALID_MONITORING_TEMPLATE",
      );
      const shellTemplateResponse = await request(
        `/api/monitoring/runtimes/${runtime.id}/active-monitors`,
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            name: "Unsupported templated shell",
            provider: "shell",
            configuration: { scriptId: "worker-health" },
            templateRef: { id: "health", version: "1" },
          },
          origin: true,
        },
      );
      assert.equal(shellTemplateResponse.status, 422);
      assert.equal(
        (await shellTemplateResponse.json()).error.code,
        "SHELL_TEMPLATE_NOT_SUPPORTED",
      );
      const unifiedDefinition =
        integratedMonitoringTemplateSeeds()[0].definition;
      const unifiedTemplateResponse = await request(
        "/api/monitoring/templates",
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            name: "Unified external health",
            description: "Unified contract integration template",
            definition: unifiedDefinition,
          },
          origin: true,
        },
      );
      assert.equal(unifiedTemplateResponse.status, 201);
      const unifiedTemplate = (await unifiedTemplateResponse.json()).template;
      assert.equal(unifiedTemplate.definition.schemaVersion, "1");
      const unifiedVersionResponse = await request(
        `/api/monitoring/templates/${unifiedTemplate.id}`,
        {
          cookie: adminCookie,
          method: "PATCH",
          body: {
            name: unifiedTemplate.name,
            description: "Second immutable unified version",
            definition: {
              ...unifiedDefinition,
              transformation: {
                ...unifiedDefinition.transformation,
                expression:
                  '{"status": status, "message": message, "metadata": metadata}',
              },
            },
          },
          origin: true,
        },
      );
      assert.equal(unifiedVersionResponse.status, 201);
      const unifiedVersion = (await unifiedVersionResponse.json()).template;
      assert.equal(unifiedVersion.version, "2");
      assert.equal(unifiedVersion.derivedFromVersion, "1");
      const unifiedActivationResponse = await request(
        `/api/monitoring/templates/${unifiedTemplate.id}/versions/2/activate`,
        { cookie: adminCookie, method: "POST", body: {}, origin: true },
      );
      assert.equal(unifiedActivationResponse.status, 200);
      assert.equal(
        (await unifiedActivationResponse.json()).template.status,
        "active",
      );
      const unifiedContractResponse = await request(
        `/api/monitoring/templates/${unifiedTemplate.id}/versions/2/contract`,
        { cookie: adminCookie },
      );
      assert.equal(unifiedContractResponse.status, 200);
      const unifiedContract = (await unifiedContractResponse.json()).contract;
      assert.deepEqual(unifiedContract.templateRef, {
        id: unifiedTemplate.id,
        version: "2",
      });
      assert.equal(unifiedContract.transformation.language, "jsonata");
      assert.deepEqual(
        unifiedContract.input.sample,
        unifiedDefinition.input.sample,
      );
      const unifiedValidationResponse = await request(
        `/api/monitoring/templates/${unifiedTemplate.id}/versions/2/validate`,
        {
          cookie: adminCookie,
          method: "POST",
          body: { sample: unifiedDefinition.input.sample },
          origin: true,
        },
      );
      assert.equal(unifiedValidationResponse.status, 200);
      assert.equal(
        (await unifiedValidationResponse.json()).validation.result.status,
        "healthy",
      );
      const unifiedSignalResponse = await request(signalRoute, {
        cookie: adminCookie,
        method: "POST",
        body: {
          signalId: "monitor:unified:1",
          status: "unavailable",
          observedAt: "2026-07-31T14:30:00.000Z",
          source: "unified-external-monitor",
          message: "client result must be ignored",
          metadata: { client_result: "ignored" },
          payload: unifiedDefinition.input.sample,
          templateRef: { id: unifiedTemplate.id, version: "2" },
        },
        origin: true,
      });
      assert.equal(unifiedSignalResponse.status, 201);
      const unifiedSignal = (await unifiedSignalResponse.json()).signal;
      assert.equal(unifiedSignal.status, "healthy");
      assert.equal(unifiedSignal.message, "Monitoramento concluído.");
      assert.equal(unifiedSignal.metadata.service_up, true);
      assert.equal(unifiedSignal.metadata.client_result, undefined);
      assert.deepEqual(unifiedSignal.templateRef, {
        id: unifiedTemplate.id,
        version: "2",
      });
      assert.equal(unifiedSignal.templateSnapshot.schemaVersion, "1");
      assert.deepEqual(
        unifiedSignal.metadataPresentation,
        unifiedSignal.templateSnapshot.presentation,
      );
      const persistedUnifiedTemplate = await (
        await request(`/api/monitoring/templates/${unifiedTemplate.id}`, {
          cookie: adminCookie,
        })
      ).json();
      assert.equal(persistedUnifiedTemplate.template.versions.length, 2);
      assert.equal(persistedUnifiedTemplate.template.version, "2");
      const invalidJsonataTemplateResponse = await request(
        "/api/monitoring/templates",
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            name: "Invalid JSONata draft",
            description: "Compilation must fail before activation",
            definition: {
              ...unifiedDefinition,
              transformation: {
                language: "jsonata",
                expression: "not valid [",
              },
            },
          },
          origin: true,
        },
      );
      assert.equal(invalidJsonataTemplateResponse.status, 201);
      const invalidJsonataTemplate = (
        await invalidJsonataTemplateResponse.json()
      ).template;
      const invalidJsonataActivation = await request(
        `/api/monitoring/templates/${invalidJsonataTemplate.id}/versions/1/activate`,
        { cookie: adminCookie, method: "POST", body: {}, origin: true },
      );
      assert.equal(invalidJsonataActivation.status, 422);
      assert.equal(
        (await invalidJsonataActivation.json()).error.code,
        "MONITORING_TEMPLATE_EVALUATION_FAILED",
      );
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
      const templateCreateResponse = await request(
        "/api/monitoring/templates",
        {
          cookie: adminCookie,
          method: "POST",
          body: {
            name: "REST health",
            description: "Integration template",
            definition: templateDefinition,
          },
          origin: true,
        },
      );
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
      const monitoredTopology = (await monitoredTopologyResponse.json())
        .topology;
      assert.ok(monitoredTopology.applicationIds.includes(application.id));
      assert.ok(monitoredTopology.deploymentIds.includes(deployment.id));
      assert.ok(monitoredTopology.runtimeIds.includes(runtime.id));
      const activeMonitorList = await (
        await request(
          `/api/monitoring/runtimes/${runtime.id}/active-monitors`,
          { cookie: adminCookie },
        )
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
      const timelineAfterActive = await (
        await request(`/api/monitoring/runtimes/${runtime.id}/timeline`, {
          cookie: adminCookie,
        })
      ).json();
      assert.equal(
        timelineAfterActive.items.filter(({ origin }) => origin === "active")
          .length,
        1,
      );
      const templateUsage = await (
        await request(
          `/api/monitoring/templates/${template.id}/versions/${template.version}/usage`,
          { cookie: adminCookie },
        )
      ).json();
      assert.equal(templateUsage.usage.activeMonitors, 1);
      assert.equal(templateUsage.usage.observations, 1);
      const templateDeleteResponse = await request(
        `/api/monitoring/templates/${template.id}/versions/${template.version}`,
        { cookie: adminCookie, method: "DELETE", origin: true },
      );
      assert.equal(templateDeleteResponse.status, 409);
      const activeMonitorIndexNames = (
        await database
          .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
          .indexes()
      ).map(({ name }) => name);
      assert.ok(
        activeMonitorIndexNames.includes(
          "runtime_active_monitor_catalog_filter",
        ),
      );
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
      assert.equal(applicationHealth.health.details.kind, "health");
      assert.equal(applicationHealth.health.details.items.length, 1);
      assert.equal(
        applicationHealth.health.details.items[0].components[0].deployments[0]
          .runtimes[0].latestSignal.metadata.disk_usage_percent,
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
        home.data["default-application-health-6"].items[0].components[0]
          .deployments[0].runtimes[0];
      assert.equal(
        homeMonitoringRuntime.latestSignal.metadata.disk_usage_percent,
        85,
      );
      assert.equal(
        homeMonitoringRuntime.latestSignal.metadataPresentation.series[0]
          .visualization,
        "line",
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
      assert.equal(
        configuredHome.configuration.widgets[0].config.environment,
        "production",
      );
      const billingHealth = configuredHome.data["billing-health"];
      assert.equal(billingHealth.kind, "health");
      assert.equal(billingHealth.applicationId, application.id);
      assert.equal(billingHealth.environment, "production");
      assert.equal(billingHealth.items.length, 1);
      assert.equal(billingHealth.items[0].name, application.name);
      assert.equal(
        billingHealth.items[0].components[0].deployments[0].runtimes[0].server
          .name,
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
