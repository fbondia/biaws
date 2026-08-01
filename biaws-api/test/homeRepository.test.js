import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApplicationHealthItems,
  defaultHomeWidgets,
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
        config: { applicationId: "billing" },
      },
    ],
    actor,
  );
  assert.equal(widgets.length, 3);
  assert.equal(widgets[2].config.applicationId, "billing");
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
});

test("application health groups only monitored runtimes with topology and server", () => {
  const items = buildApplicationHealthItems({
    applications: [
      { id: "application-1", key: "billing", name: "Billing" },
      { id: "application-2", key: "unused", name: "Sem monitoramento" },
    ],
    components: [
      { id: "component-1", key: "api", name: "API" },
    ],
    deployments: [
      {
        id: "deployment-1",
        key: "production",
        name: "Produção",
        componentId: "component-1",
        environment: "production",
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
          source: "zabbix",
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
});
