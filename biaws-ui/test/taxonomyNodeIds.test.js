import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUniqueTaxonomyId,
  slugifyTaxonomyNode,
} from "../src/components/taxonomy/nodeIds.js";

const taxonomy = [
  {
    id: "produto",
    label: "Produto",
    children: [{ id: "produto-detalhes", label: "Detalhes" }],
  },
  { id: "servico", label: "Serviço" },
];

test("builds child IDs from the parent path when labels repeat", () => {
  assert.equal(
    buildUniqueTaxonomyId(taxonomy, "servico", "Detalhes"),
    "servico-detalhes",
  );
});

test("adds a suffix when the generated path ID already exists", () => {
  assert.equal(
    buildUniqueTaxonomyId(taxonomy, "produto", "Detalhes"),
    "produto-detalhes-2",
  );
});

test("generates a usable ID for labels containing only symbols", () => {
  assert.equal(slugifyTaxonomyNode("Árvore & Nó"), "arvore-no");
  assert.equal(
    buildUniqueTaxonomyId(taxonomy, "servico", "!!!"),
    "servico-novo-no",
  );
});
