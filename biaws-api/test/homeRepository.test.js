import assert from "node:assert/strict";
import test from "node:test";

import {
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
