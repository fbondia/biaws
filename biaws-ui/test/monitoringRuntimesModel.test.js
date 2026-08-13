import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationsInCollection,
  collectionColumns,
  collectionPath,
  deploymentsForComponent,
  latestEventForMonitor,
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
