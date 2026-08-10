import assert from "node:assert/strict";
import test from "node:test";

import { isItemReorderDrop } from "../src/components/shared/ResourceCollections/model.js";

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
