import assert from "node:assert/strict";
import test from "node:test";

import {
  filterTaxonomyForApplication,
  findTaxonomyNode,
} from "../src/components/taxonomy/scope.js";

const taxonomy = [
  {
    id: "shared",
    label: "Compartilhado",
    applicationIds: [],
    children: [
      { id: "only-a", label: "Somente A", applicationIds: ["a"] },
      { id: "only-b", label: "Somente B", applicationIds: ["b"] },
    ],
  },
];

test("builds the effective application taxonomy without mutating the catalog", () => {
  const effective = filterTaxonomyForApplication(taxonomy, "a");

  assert.deepEqual(
    effective[0].children.map(({ id }) => id),
    ["only-a"],
  );
  assert.equal(taxonomy[0].children.length, 2);
});

test("finds nested taxonomy nodes", () => {
  assert.equal(findTaxonomyNode(taxonomy, "only-b")?.label, "Somente B");
  assert.equal(findTaxonomyNode(taxonomy, "missing"), null);
});
