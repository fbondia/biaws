import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApplicationHealthItems,
  defaultHomeWidgets,
  filterRuntimesByDeploymentEnvironment,
  HOME_WIDGET_CATALOG,
  normalizeHomeWidgets,
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
    runtime.latestSignal.metadataPresentation.fields[2].format,
    "percent",
  );
});
