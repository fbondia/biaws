import assert from "node:assert/strict";
import test from "node:test";

import { buildRuntimeDocumentTree } from "../src/components/catalog/RuntimeProcedureSelectorDialog/model.js";

test("runtime document tree keeps only collection paths containing filtered documents", () => {
  const tree = buildRuntimeDocumentTree(
    [
      { id: "operations", name: "Operações", parentId: "" },
      { id: "deploy", name: "Deploy", parentId: "operations" },
      { id: "unused", name: "Sem resultados", parentId: "" },
    ],
    [
      { id: "document-2", title: "Validar", collectionId: "deploy" },
      { id: "document-1", title: "Publicar", collectionId: "deploy" },
      { id: "document-root", title: "Rollback", collectionId: "" },
    ],
  );

  assert.equal(tree.collections.length, 1);
  assert.equal(tree.collections[0].id, "operations");
  assert.equal(tree.collections[0].children[0].id, "deploy");
  assert.deepEqual(
    tree.collections[0].children[0].documents.map(({ id }) => id),
    ["document-1", "document-2"],
  );
  assert.deepEqual(
    tree.documents.map(({ id }) => id),
    ["document-root"],
  );
});

test("documents with an unknown collection are exposed at the root", () => {
  const tree = buildRuntimeDocumentTree(
    [],
    [{ id: "document-1", title: "Publicar", collectionId: "removed" }],
  );
  assert.deepEqual(
    tree.documents.map(({ id }) => id),
    ["document-1"],
  );
});
