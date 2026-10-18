import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogChildren,
  catalogDescendants,
  catalogHierarchyError,
  moveCatalogItem,
  removeCatalogItem,
} from "../../shared/catalogTree.js";
import { documentMarkdown } from "../../shared/documentContent.js";

const items = [
  { id: "api", title: "API", description: "Contrato" },
  { id: "endpoint", parentId: "api", title: "Status", description: "GET /status" },
  { id: "worker", title: "Worker", description: "Processa eventos" },
  { id: "portal", title: "Portal", description: "Operação" },
];
test("catalog moves preserve subtrees, support sibling ordering, nesting and returning to root", () => {
  const reordered = moveCatalogItem(items, "portal", "", "api");
  assert.deepEqual(
    catalogChildren(reordered).map(({ id }) => id),
    ["portal", "api", "worker"],
  );
  const nested = moveCatalogItem(reordered, "api", "worker");
  assert.deepEqual([...catalogDescendants(nested, "worker")].sort(), ["api", "endpoint", "worker"]);
  const rooted = moveCatalogItem(nested, "api", "", "portal");
  assert.deepEqual(
    catalogChildren(rooted).map(({ id }) => id),
    ["api", "portal", "worker"],
  );
  assert.equal(rooted.find(({ id }) => id === "endpoint").parentId, "api");
  assert.equal(items[0].parentId, undefined);
  assert.deepEqual(
    removeCatalogItem(rooted, "api").map(({ id }) => id),
    ["portal", "worker"],
  );
});
test("catalog hierarchy rejects cycles, unknown parents and excessive depth", () => {
  assert.equal(moveCatalogItem(items, "api", "endpoint"), items);
  assert.equal(moveCatalogItem(items, "api", "api"), items);
  assert.equal(moveCatalogItem(items, "api", "missing"), items);
  assert.ok(catalogHierarchyError([{ id: "orphan", parentId: "missing" }]));
  assert.ok(
    catalogHierarchyError([
      { id: "one", parentId: "two" },
      { id: "two", parentId: "one" },
    ]),
  );
  const deep = Array.from({ length: 21 }, (_, index) => ({
    id: String(index),
    ...(index ? { parentId: String(index - 1) } : {}),
  }));
  assert.ok(catalogHierarchyError(deep));
  assert.equal(catalogHierarchyError(deep.slice(0, 20)), "");
});
test("catalog exports follow tree and sibling order rather than the flat storage order", () => {
  const nested = moveCatalogItem(items, "api", "worker");
  const markdown = documentMarkdown({ documentType: "catalog", details: { items: nested } });
  assert.equal(
    markdown,
    "## Worker\n\nProcessa eventos\n\n### API\n\nContrato\n\n#### Status\n\nGET /status\n\n## Portal\n\nOperação",
  );
});
