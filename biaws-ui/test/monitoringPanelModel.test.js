import assert from "node:assert/strict";
import test from "node:test";

import {
  groupMonitoringTargets,
  runtimeHealthData,
  selectedMonitoringTargets,
} from "../src/components/monitoring/runtimes/panelModel.js";

const targets = [
  { id: "runtime-1", application: { id: "app-1", name: "API" } },
  { id: "runtime-2", application: { id: "app-1", name: "API" } },
  { id: "runtime-3", application: { id: "app-2", name: "Portal" } },
];

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
