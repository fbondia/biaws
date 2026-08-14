import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCollectionNavigationContext,
  buildCollectionNavigationUpdateOperation,
  COLLECTION_NAVIGATION_CONTEXTS,
  normalizeCollectionNavigationMutation,
  normalizeMonitoringPanelMutation,
} from "../src/repositories/userPreferencesRepository.js";

test("collection navigation preferences cover every collection surface", () => {
  assert.deepEqual(COLLECTION_NAVIGATION_CONTEXTS, [
    "applications",
    "documents",
    "demands",
    "secrets",
    "skills",
    "servers",
  ]);
  assert.equal(assertCollectionNavigationContext("documents"), "documents");
  assert.throws(
    () => assertCollectionNavigationContext("unknown"),
    (error) => error.code === "COLLECTION_NAVIGATION_CONTEXT_NOT_FOUND",
  );
});

test("monitoring panel preferences normalize a bounded runtime selection", () => {
  assert.deepEqual(
    normalizeMonitoringPanelMutation({
      runtimeIds: [" runtime-1 ", "runtime-2", "runtime-1"],
    }),
    {
      runtimeIds: ["runtime-1", "runtime-2"],
      widgets: [
        { runtimeId: "runtime-1", size: "medium-2" },
        { runtimeId: "runtime-2", size: "medium-2" },
      ],
    },
  );
  assert.deepEqual(
    normalizeMonitoringPanelMutation({
      widgets: [
        { runtimeId: " runtime-1 ", size: "small" },
        { runtimeId: "runtime-2", size: "medium" },
      ],
    }),
    {
      runtimeIds: ["runtime-1", "runtime-2"],
      widgets: [
        { runtimeId: "runtime-1", size: "small" },
        { runtimeId: "runtime-2", size: "medium-2" },
      ],
    },
  );
  for (const payload of [
    null,
    {},
    { runtimeIds: "runtime-1" },
    { runtimeIds: [], extra: true },
    { runtimeIds: [], widgets: [] },
    { widgets: [{ runtimeId: "runtime-1", size: "huge" }] },
    { widgets: [{ runtimeId: "runtime-1", size: "small", extra: true }] },
    { runtimeIds: Array.from({ length: 101 }, (_, index) => `r-${index}`) },
  ]) {
    assert.throws(
      () => normalizeMonitoringPanelMutation(payload),
      (error) => error.code === "INVALID_MONITORING_PANEL_PREFERENCE",
    );
  }
});

test("collection navigation mutations reject malformed input", () => {
  assert.deepEqual(
    normalizeCollectionNavigationMutation({
      collectionId: " collection-1 ",
      collapsed: true,
    }),
    { collectionId: "collection-1", collapsed: true },
  );
  for (const payload of [
    null,
    { collectionId: "collection-1", collapsed: "true" },
    { collectionId: "", collapsed: true },
    { collectionId: "collection-1", collapsed: true, extra: true },
  ]) {
    assert.throws(
      () => normalizeCollectionNavigationMutation(payload),
      (error) => error.code === "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
    );
  }
});

test("collection navigation updates atomically add and remove per user", () => {
  const actor = { workspaceId: "workspace-1", userId: "user-1" };
  const now = new Date("2026-08-10T12:00:00.000Z");
  const collapsed = buildCollectionNavigationUpdateOperation(
    "documents",
    { collectionId: "collection-1", collapsed: true },
    actor,
    now,
  );
  assert.deepEqual(collapsed.filter, actor);
  assert.deepEqual(collapsed.update.$addToSet, {
    "collectionNavigation.documents.collapsedCollectionIds": "collection-1",
  });
  assert.equal(collapsed.update.$pull, undefined);
  assert.equal(
    collapsed.update.$set["collectionNavigation.documents.updatedAt"],
    now,
  );

  const expanded = buildCollectionNavigationUpdateOperation(
    "documents",
    { collectionId: "collection-1", collapsed: false },
    actor,
    now,
  );
  assert.deepEqual(expanded.update.$pull, {
    "collectionNavigation.documents.collapsedCollectionIds": "collection-1",
  });
  assert.equal(expanded.update.$addToSet, undefined);
});
