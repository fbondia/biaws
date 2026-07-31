import assert from "node:assert/strict";
import test from "node:test";

import {
  collectTaxonomyIds,
  collectTaxonomyIdsWithDescendants,
  filterTaxonomyForApplication,
} from "../src/helpers/taxonomy.js";

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

test("filters taxonomy to shared nodes and nodes assigned to an application", () => {
  const scopedTaxonomy = [
    {
      id: "shared",
      children: [
        { id: "app-a", applicationIds: ["a"] },
        { id: "app-b", applicationIds: ["b"] },
      ],
    },
    { id: "only-a", applicationIds: ["a"] },
  ];

  assert.deepEqual(
    collectTaxonomyIds(filterTaxonomyForApplication(scopedTaxonomy, "a")),
    ["shared", "app-a", "only-a"],
  );
  assert.deepEqual(
    collectTaxonomyIds(filterTaxonomyForApplication(scopedTaxonomy, "b")),
    ["shared", "app-b"],
  );
});

test("returns only shared taxonomy for workspace-level knowledge", () => {
  const scopedTaxonomy = [
    { id: "shared" },
    { id: "specific", applicationIds: ["a"] },
  ];

  assert.deepEqual(
    collectTaxonomyIds(filterTaxonomyForApplication(scopedTaxonomy, "")),
    ["shared"],
  );
});
