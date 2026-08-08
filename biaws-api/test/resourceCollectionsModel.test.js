import assert from "node:assert/strict";
import test from "node:test";

import {
  assertResourceCollectionType,
  RESOURCE_COLLECTION_TYPES,
} from "../src/repositories/resourceCollectionsRepository.js";

test("resource collections support improvement groupings", () => {
  assert.equal(RESOURCE_COLLECTION_TYPES.includes("demands"), true);
  assert.equal(assertResourceCollectionType("demands"), "demands");
});
