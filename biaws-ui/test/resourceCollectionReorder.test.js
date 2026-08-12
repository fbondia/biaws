import assert from "node:assert/strict";
import test from "node:test";

import {
  isItemReorderDrop,
  populatedCollections,
} from "../src/components/shared/ResourceCollections/model.js";

const getItemId = (item) => item.id;

test("collection items can be reordered inside the same collection", () => {
  assert.equal(
    isItemReorderDrop(
      { type: "item", id: "improvement-1", collectionId: "roadmap" },
      { id: "improvement-2", collectionId: "roadmap" },
      getItemId,
    ),
    true,
  );
});

test("collection item reorder rejects itself and cross-collection targets", () => {
  assert.equal(
    isItemReorderDrop(
      { type: "item", id: "improvement-1", collectionId: "roadmap" },
      { id: "improvement-1", collectionId: "roadmap" },
      getItemId,
    ),
    false,
  );
  assert.equal(
    isItemReorderDrop(
      { type: "item", id: "improvement-1", collectionId: "roadmap" },
      { id: "improvement-2", collectionId: "backlog" },
      getItemId,
    ),
    false,
  );
});

test("populated collection filter keeps ancestors and removes empty branches", () => {
  const collections = [
    { id: "procedures", name: "Procedures", parentId: "" },
    { id: "deploy", name: "Deploy", parentId: "procedures" },
    { id: "scripts", name: "Scripts", parentId: "deploy" },
    { id: "empty", name: "Empty", parentId: "procedures" },
  ];

  assert.deepEqual(
    populatedCollections(collections, [
      { id: "document-1", collectionId: "scripts" },
    ]).map(({ id }) => id),
    ["procedures", "deploy", "scripts"],
  );
});
