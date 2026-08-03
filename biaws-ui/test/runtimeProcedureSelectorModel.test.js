import assert from "node:assert/strict";
import test from "node:test";

import { buildRuntimeProcedureTree } from "../src/components/catalog/runtimeProcedureSelectorModel.js";

test("runtime procedure tree keeps only collection paths containing filtered procedures", () => {
  const tree = buildRuntimeProcedureTree(
    [
      { id: "operations", name: "Operações", parentId: "" },
      { id: "deploy", name: "Deploy", parentId: "operations" },
      { id: "unused", name: "Sem resultados", parentId: "" },
    ],
    [
      { id: "procedure-2", title: "Validar", collectionId: "deploy" },
      { id: "procedure-1", title: "Publicar", collectionId: "deploy" },
      { id: "procedure-root", title: "Rollback", collectionId: "" },
    ],
  );

  assert.equal(tree.collections.length, 1);
  assert.equal(tree.collections[0].id, "operations");
  assert.equal(tree.collections[0].children[0].id, "deploy");
  assert.deepEqual(
    tree.collections[0].children[0].procedures.map(({ id }) => id),
    ["procedure-1", "procedure-2"],
  );
  assert.deepEqual(
    tree.procedures.map(({ id }) => id),
    ["procedure-root"],
  );
});

test("procedures with an unknown collection are exposed at the root", () => {
  const tree = buildRuntimeProcedureTree(
    [],
    [{ id: "procedure-1", title: "Publicar", collectionId: "removed" }],
  );
  assert.deepEqual(
    tree.procedures.map(({ id }) => id),
    ["procedure-1"],
  );
});
