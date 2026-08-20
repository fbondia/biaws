import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  groupMonitoringTargets,
  moveMonitoringWidget,
  runtimeHealthData,
  selectedMonitoringTargets,
  selectedMonitoringWidgets,
} from "../src/components/monitoring/runtimes/MonitoringRuntimesView/components/MonitoringDashboard/model.js";

const targets = [
  { id: "runtime-1", application: { id: "app-1", name: "API" } },
  { id: "runtime-2", application: { id: "app-1", name: "API" } },
  { id: "runtime-3", application: { id: "app-2", name: "Portal" } },
];

test("monitoring grid fills the panel and large widgets span every column", () => {
  const styles = readFileSync(
    new URL("../src/styles/features/monitoring-center.css", import.meta.url),
    "utf8",
  );
  assert.match(
    styles,
    /\.monitoringPanelGrid\s*\{[^}]*width:\s*100%;[^}]*justify-self:\s*stretch;/su,
  );
  assert.match(
    styles,
    /\.monitoringPanelWidget\.homeWidget-large\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/su,
  );
});

test("monitoring panel selection preserves catalog order and groups applications", () => {
  assert.deepEqual(
    selectedMonitoringTargets(targets, ["runtime-3", "runtime-1"]).map(
      ({ id }) => id,
    ),
    ["runtime-1", "runtime-3"],
  );
  assert.deepEqual(
    groupMonitoringTargets(targets).map(({ application, targets: items }) => [
      application.id,
      items.length,
    ]),
    [
      ["app-1", 2],
      ["app-2", 1],
    ],
  );
});

test("monitoring panel keeps the configured widget order", () => {
  assert.deepEqual(
    selectedMonitoringWidgets(targets, [
      { runtimeId: "runtime-3", size: "large" },
      { runtimeId: "runtime-1", size: "small" },
    ]).map(({ target, widget }) => [target.id, widget.size]),
    [
      ["runtime-3", "large"],
      ["runtime-1", "small"],
    ],
  );
});

test("monitoring panel reorders widgets by runtime id", () => {
  const widgets = [
    { runtimeId: "runtime-1", size: "small" },
    { runtimeId: "runtime-2", size: "medium-2" },
    { runtimeId: "runtime-3", size: "large" },
  ];
  assert.deepEqual(
    moveMonitoringWidget(widgets, "runtime-3", "runtime-1").map(
      ({ runtimeId }) => runtimeId,
    ),
    ["runtime-3", "runtime-1", "runtime-2"],
  );
  assert.equal(moveMonitoringWidget(widgets, "missing", "runtime-1"), widgets);
});

test("monitoring panel isolates one runtime without mutating health data", () => {
  const health = {
    kind: "health",
    items: [
      {
        id: "app-1",
        components: [
          {
            id: "component-1",
            deployments: [
              {
                id: "deployment-1",
                runtimes: [{ id: "runtime-1" }, { id: "runtime-2" }],
              },
            ],
          },
        ],
      },
    ],
  };
  const filtered = runtimeHealthData(health, "runtime-2");
  assert.deepEqual(
    filtered.items[0].components[0].deployments[0].runtimes.map(({ id }) => id),
    ["runtime-2"],
  );
  assert.equal(health.items[0].components[0].deployments[0].runtimes.length, 2);
});
