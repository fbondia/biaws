import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScheduleCollectionRows,
  requestsInCollectionBranch,
} from "../src/components/requests/requestUtils/scheduleCollections.js";

test("root schedule includes improvements from every nested collection", () => {
  const collections = [
    { id: "parent", parentId: "" },
    { id: "child", parentId: "parent" },
    { id: "sibling", parentId: "" },
  ];
  const requests = [
    { id: "root", collectionId: "" },
    { id: "parent", collectionId: "parent" },
    { id: "child", collectionId: "child" },
    { id: "sibling", collectionId: "sibling" },
  ];

  assert.deepEqual(
    requestsInCollectionBranch(collections, requests, ""),
    requests,
  );
  assert.deepEqual(
    requestsInCollectionBranch(collections, requests, "parent").map(
      (request) => request.id,
    ),
    ["parent", "child"],
  );
});

test("schedule rows recursively group improvements by collection", () => {
  const collections = [
    { id: "platform", name: "Plataforma", parentId: "" },
    { id: "api", name: "API", parentId: "platform" },
    { id: "empty", name: "Sem melhorias", parentId: "" },
  ];
  const rootItem = { request: { id: "root", collectionId: "" } };
  const platformItem = {
    request: { id: "platform-item", collectionId: "platform" },
  };
  const apiItem = { request: { id: "api-item", collectionId: "api" } };

  const rows = buildScheduleCollectionRows(collections, [
    rootItem,
    platformItem,
    apiItem,
  ]);

  assert.deepEqual(
    rows.map((row) =>
      row.kind === "collection"
        ? [row.kind, row.name, row.depth, row.itemCount]
        : [row.kind, row.item.request.id, row.depth],
    ),
    [
      ["collection", "Raiz", 0, 3],
      ["collection", "Plataforma", 1, 2],
      ["collection", "API", 2, 1],
      ["item", "api-item", 3],
      ["item", "platform-item", 2],
      ["item", "root", 1],
    ],
  );
});

test("schedule rows place improvements from unknown collections at root", () => {
  const item = { request: { id: "orphan", collectionId: "missing" } };
  const rows = buildScheduleCollectionRows([], [item]);

  assert.equal(rows[0].name, "Raiz");
  assert.equal(rows[1].item, item);
  assert.equal(rows[1].depth, 1);
});
