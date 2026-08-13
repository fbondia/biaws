import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPendingTasksMetric,
  buildApplicationHealthItems,
  defaultHomeWidgets,
  filterRuntimesByDeploymentEnvironment,
  HOME_WIDGET_CATALOG,
  normalizeHomeWidgets,
  pendingTasksPagination,
} from "../src/repositories/homeRepository.js";

const actor = {
  permissions: ["issues.read", "demands.read", "runtimes.read"],
};

test("home catalog starts with extensible configured widget definitions", () => {
  assert.deepEqual(
    HOME_WIDGET_CATALOG.map(({ id }) => id),
    [
      "issues-period",
      "open-issues-by-application",
      "open-issues-by-type",
      "pending-tasks",
      "application-health",
    ],
  );
  const monitoring = HOME_WIDGET_CATALOG.find(
    ({ id }) => id === "application-health",
  );
  assert.equal(monitoring.configuration.fields[0].type, "application");
  assert.equal(monitoring.configuration.fields[1].key, "environment");
  assert.equal(monitoring.configuration.fields[1].type, "select");
  const presentationField = monitoring.configuration.fields.find(
    ({ key }) => key === "presentation",
  );
  assert.deepEqual(
    presentationField.options.map(({ value }) => value),
    ["list", "tabs"],
  );
});

test("default home follows permissions and creates separate period instances", () => {
  const widgets = defaultHomeWidgets({ permissions: ["issues.read"] });
  assert.equal(widgets.length, 4);
  assert.deepEqual(
    widgets.slice(0, 2).map(({ config }) => config.period),
    ["week", "month"],
  );
  assert.equal(
    widgets.some(({ widgetId }) => widgetId === "pending-tasks"),
    false,
  );
});

test("home configuration accepts repeated widget types with unique instances", () => {
  const widgets = normalizeHomeWidgets(
    [
      {
        id: "week",
        widgetId: "issues-period",
        size: "small",
        config: { period: "week" },
      },
      {
        id: "month",
        widgetId: "issues-period",
        size: "small",
        config: { period: "month" },
      },
      {
        id: "health-billing",
        widgetId: "application-health",
        size: "medium",
        config: { applicationId: "billing", environment: "production" },
      },
    ],
    actor,
  );
  assert.equal(widgets.length, 3);
  assert.equal(widgets[2].config.applicationId, "billing");
  assert.equal(widgets[2].config.environment, "production");
  assert.equal(widgets[2].config.presentation, "list");
  assert.equal(widgets[2].size, "medium-2");
});

test("home configuration accepts every grid size and migrates legacy medium", () => {
  const sizes = ["small", "medium-1", "medium-2", "large", "medium"];
  const widgets = normalizeHomeWidgets(
    sizes.map((size, index) => ({
      id: `period-${index}`,
      widgetId: "issues-period",
      size,
      config: { period: "week" },
    })),
    actor,
  );
  assert.deepEqual(
    widgets.map(({ size }) => size),
    ["small", "medium-1", "medium-2", "large", "medium-2"],
  );
});

test("runtime health filter follows its hierarchy and forces tabs", () => {
  const [widget] = normalizeHomeWidgets(
    [
      {
        id: "runtime-health",
        widgetId: "application-health",
        config: {
          applicationId: "application-1",
          componentId: "component-1",
          deploymentId: "deployment-1",
          runtimeId: "runtime-1",
          presentation: "list",
        },
      },
    ],
    actor,
  );
  assert.equal(widget.config.runtimeId, "runtime-1");
  assert.equal(widget.config.presentation, "tabs");
  assert.throws(
    () =>
      normalizeHomeWidgets(
        [
          {
            id: "invalid-runtime-health",
            widgetId: "application-health",
            config: { applicationId: "application-1", runtimeId: "runtime-1" },
          },
        ],
        actor,
      ),
    (error) => error.code === "INVALID_HOME_CONFIGURATION",
  );
});

test("home configuration rejects unauthorized widgets and invalid config", () => {
  assert.throws(
    () =>
      normalizeHomeWidgets(
        [
          {
            id: "tasks",
            widgetId: "pending-tasks",
            config: {},
          },
        ],
        { permissions: ["issues.read"] },
      ),
    (error) => error.code === "INVALID_HOME_WIDGET",
  );
  assert.throws(
    () =>
      normalizeHomeWidgets(
        [
          {
            id: "period",
            widgetId: "issues-period",
            config: { period: "year" },
          },
        ],
        actor,
      ),
    (error) => error.code === "INVALID_HOME_CONFIGURATION",
  );
  assert.throws(
    () =>
      normalizeHomeWidgets(
        [
          {
            id: "health",
            widgetId: "application-health",
            config: { presentation: "cards" },
          },
        ],
        actor,
      ),
    (error) => error.code === "INVALID_HOME_CONFIGURATION",
  );
  assert.throws(
    () =>
      normalizeHomeWidgets(
        [
          {
            id: "health",
            widgetId: "application-health",
            config: { environment: "local" },
          },
        ],
        actor,
      ),
    (error) => error.code === "INVALID_HOME_CONFIGURATION",
  );
});

test("pending tasks use six-item pages by default", () => {
  assert.deepEqual(pendingTasksPagination(), { page: 1, limit: 6, skip: 0 });
  assert.deepEqual(pendingTasksPagination({ page: "3", limit: "8" }), {
    page: 3,
    limit: 8,
    skip: 16,
  });
  assert.throws(
    () => pendingTasksPagination({ page: "invalid" }),
    (error) => error.code === "INVALID_QUERY",
  );
});

test("pending tasks metric returns a deterministic page and pagination metadata", async () => {
  const observations = {};
  const requests = [
    {
      _id: "request-1",
      clientCode: "MEL-001",
      title: "Melhoria principal",
    },
  ];
  const tasks = Array.from({ length: 8 }, (_, index) => ({
    _id: `task-${index + 1}`,
    code: `TASK-${index + 1}`,
    requestId: "request-1",
    title: `Tarefa ${index + 1}`,
    status: "Pendente",
  }));
  const database = {
    collection(name) {
      if (name === "requests") {
        return {
          find(filter) {
            observations.requestFilter = filter;
            return {
              project() {
                return this;
              },
              async toArray() {
                return requests;
              },
            };
          },
        };
      }
      assert.equal(name, "requestTasks");
      return {
        async countDocuments(filter) {
          observations.taskFilter = filter;
          return tasks.length;
        },
        find(filter) {
          observations.taskFilter = filter;
          let skip = 0;
          let limit = tasks.length;
          return {
            sort(value) {
              observations.sort = value;
              return this;
            },
            skip(value) {
              skip = value;
              observations.skip = value;
              return this;
            },
            limit(value) {
              limit = value;
              observations.limit = value;
              return this;
            },
            async toArray() {
              return tasks.slice(skip, skip + limit);
            },
          };
        },
      };
    },
  };
  const result = await buildPendingTasksMetric(
    database,
    {
      workspaceId: "workspace-1",
      permissionScopes: { "demands.read": { workspace: true } },
    },
    { page: 2, limit: 3 },
  );

  assert.deepEqual(observations.requestFilter, { workspaceId: "workspace-1" });
  assert.deepEqual(observations.sort, {
    endDate: 1,
    createdAt: -1,
    _id: 1,
  });
  assert.equal(observations.skip, 3);
  assert.equal(observations.limit, 3);
  assert.deepEqual(
    result.items.map(({ id }) => id),
    ["task-4", "task-5", "task-6"],
  );
  assert.equal(result.items[0].requestId, "request-1");
  assert.equal(result.items[0].requestCode, "MEL-001");
  assert.equal(result.items[0].requestTitle, "Melhoria principal");
  assert.equal(result.items[0].code, "TASK-4");
  assert.equal(result.value, 8);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 3);
  assert.equal(result.hasMore, true);
});

test("application health filters runtimes by deployment environment", () => {
  const runtimes = [
    { id: "runtime-production", deploymentId: "deployment-production" },
    { id: "runtime-test", deploymentId: "deployment-test" },
  ];
  const deployments = [
    { id: "deployment-production", environment: "production" },
    { id: "deployment-test", environment: "test" },
  ];
  assert.deepEqual(
    filterRuntimesByDeploymentEnvironment(
      runtimes,
      deployments,
      "production",
    ).map(({ id }) => id),
    ["runtime-production"],
  );
  assert.equal(
    filterRuntimesByDeploymentEnvironment(runtimes, deployments).length,
    2,
  );
});

test("application health groups only monitored runtimes with topology and server", () => {
  const items = buildApplicationHealthItems({
    applications: [
      { id: "application-1", key: "billing", name: "Billing" },
      { id: "application-2", key: "unused", name: "Sem monitoramento" },
    ],
    components: [{ id: "component-1", key: "api", name: "API" }],
    deployments: [
      {
        id: "deployment-1",
        key: "production",
        name: "Produção",
        componentId: "component-1",
        environment: "production",
      },
    ],
    latestSignals: [
      {
        id: "signal-1",
        runtimeId: "runtime-1",
        metadataProfile: "sgmp-health/v1",
        templatePresentation: {
          label: "Saúde configurável",
          fields: [
            {
              key: "disk_usage_percent",
              label: "Disco do template",
              format: "percent",
              visualization: "gauge",
            },
          ],
          series: [],
        },
        metadata: {
          service_up: true,
          database_up: true,
          disk_usage_percent: 72.5,
        },
      },
    ],
    runtimes: [
      {
        id: "runtime-1",
        key: "primary",
        name: "Primário",
        applicationId: "application-1",
        componentId: "component-1",
        deploymentId: "deployment-1",
        serverId: "server-1",
        status: "degraded",
        monitoring: {
          status: "degraded",
          observedAt: "2026-08-01T12:00:00.000Z",
          receivedAt: "2026-08-01T12:00:02.000Z",
          source: "zabbix",
          message: "Latency above threshold",
        },
      },
    ],
    servers: [{ id: "server-1", key: "prod-1", name: "Produção 1" }],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].status, "degraded");
  const runtime = items[0].components[0].deployments[0].runtimes[0];
  assert.equal(runtime.key, "primary");
  assert.equal(runtime.server.name, "Produção 1");
  assert.equal(runtime.receivedAt, "2026-08-01T12:00:02.000Z");
  assert.equal(runtime.message, "Latency above threshold");
  assert.equal(runtime.latestSignal.metadata.disk_usage_percent, 72.5);
  assert.equal(runtime.latestSignal.metadataProfile, "sgmp-health/v1");
  assert.equal(
    runtime.latestSignal.metadataPresentation.label,
    "Saúde configurável",
  );
  assert.equal(
    runtime.latestSignal.metadataPresentation.fields[0].format,
    "percent",
  );
});
