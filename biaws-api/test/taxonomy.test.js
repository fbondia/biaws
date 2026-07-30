import assert from "node:assert/strict";
import test from "node:test";

import { collectTaxonomyIdsWithDescendants } from "../src/helpers/taxonomy.js";

const taxonomy = [
  {
    id: "usuario",
    children: [
      { id: "criacao-usuario" },
      {
        id: "permissoes",
        children: [{ id: "perfil-acesso" }],
      },
    ],
  },
  { id: "equipamento", children: [{ id: "instalacao" }] },
];

test("includes the selected taxonomy and all of its descendants", () => {
  assert.deepEqual(collectTaxonomyIdsWithDescendants(taxonomy, ["usuario"]), [
    "usuario",
    "criacao-usuario",
    "permissoes",
    "perfil-acesso",
  ]);
});

test("includes only the selected subtree", () => {
  assert.deepEqual(
    collectTaxonomyIdsWithDescendants(taxonomy, ["permissoes"]),
    ["permissoes", "perfil-acesso"],
  );
});

test("combines multiple selections without duplicates and preserves unknown ids", () => {
  assert.deepEqual(
    collectTaxonomyIdsWithDescendants(taxonomy, [
      "usuario",
      "criacao-usuario",
      "legado",
    ]),
    ["usuario", "criacao-usuario", "legado", "permissoes", "perfil-acesso"],
  );
});
