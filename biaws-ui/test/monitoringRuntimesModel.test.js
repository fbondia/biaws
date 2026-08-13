import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationsInCollection,
  collectionColumns,
  collectionPath,
  deploymentsForComponent,
  filterMonitoredTopology,
  latestEventForMonitor,
  runtimeListParams,
} from "../src/components/monitoring/runtimes/model.js";

const collections = [
  { id: "a", name: "A", parentId: null },
  { id: "b", name: "B", parentId: "a" },
  { id: "c", name: "C", parentId: "b" },
  { id: "z", name: "Z", parentId: null },
];

test("monitoring navigation builds deterministic collection columns", () => {
  assert.deepEqual(
    collectionPath(collections, "c").map(({ id }) => id),
    ["a", "b", "c"],
  );
  const columns = collectionColumns(collections, "b");
  assert.deepEqual(
    columns.map(({ parentId }) => parentId),
    ["", "a", "b"],
  );
  assert.deepEqual(
    columns[0].items.map(({ id }) => id),
    ["a", "z"],
  );
  assert.equal(columns[1].selectedId, "b");
});

test("monitoring navigation scopes every topology level", () => {
  assert.deepEqual(
    applicationsInCollection(
      [
        { id: "root", name: "Root" },
        { id: "nested", name: "Nested", collectionId: "a" },
      ],
      "a",
    ).map(({ id }) => id),
    ["nested"],
  );
  assert.deepEqual(
    deploymentsForComponent(
      [
        { id: "d2", name: "B", componentId: "c2" },
        { id: "d1", name: "A", componentId: "c1" },
      ],
      "c1",
    ).map(({ id }) => id),
    ["d1"],
  );
});

test("monitor overview selects the newest event for its monitor", () => {
  assert.equal(
    latestEventForMonitor(
      [
        { id: "event-2", monitorId: "monitor-2" },
        { id: "event-1", monitorId: "monitor-1" },
      ],
      "monitor-1",
    ).id,
    "event-1",
  );
});

test("runtime monitoring filter is sent only when enabled", () => {
  assert.deepEqual(runtimeListParams(false), {
    limit: 100,
    monitoredOnly: undefined,
  });
  assert.deepEqual(runtimeListParams(true), {
    limit: 100,
    monitoredOnly: true,
  });
});

test("monitored topology filter prunes every branch and keeps collection ancestors", () => {
  const filtered = filterMonitoredTopology({
    applications: [
      { id: "app-monitored", collectionId: "c" },
      { id: "app-hidden", collectionId: "z" },
    ],
    collections,
    components: [{ id: "component-1" }, { id: "component-2" }],
    deployments: [{ id: "deployment-1" }, { id: "deployment-2" }],
    monitoredOnly: true,
    topology: {
      applicationIds: ["app-monitored"],
      componentIds: ["component-1"],
      deploymentIds: ["deployment-1"],
      runtimeIds: ["runtime-1"],
    },
  });
  assert.deepEqual(
    filtered.applications.map(({ id }) => id),
    ["app-monitored"],
  );
  assert.deepEqual(
    filtered.collections.map(({ id }) => id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    filtered.components.map(({ id }) => id),
    ["component-1"],
  );
  assert.deepEqual(
    filtered.deployments.map(({ id }) => id),
    ["deployment-1"],
  );
});
