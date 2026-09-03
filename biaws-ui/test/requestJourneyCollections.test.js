import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJourneyCollectionRows,
  journeyCollectionRowKey,
  visibleJourneyRows,
} from "../src/components/requests/requestUtils/journeyCollections.js";

test("journey rows aggregate nested collections and the general total", () => {
  const collections = [
    { id: "platform", name: "Plataforma", parentId: "" },
    { id: "api", name: "API", parentId: "platform" },
  ];
  const requests = [
    {
      id: "root",
      collectionId: "",
      journeys: [{ month: "2026-09", plannedJourneys: 1, executedJourneys: 1 }],
    },
    {
      id: "platform",
      collectionId: "platform",
      journeys: [{ month: "2026-09", plannedJourneys: 2, executedJourneys: 0 }],
    },
    {
      id: "api",
      collectionId: "api",
      journeys: [{ month: "2026-10", plannedJourneys: 3, executedJourneys: 2 }],
    },
  ];

  const rows = buildJourneyCollectionRows(collections, requests, [
    "2026-09",
    "2026-10",
  ]);

  assert.deepEqual(
    rows.map((row) =>
      row.kind === "collection"
        ? [
            row.name,
            row.depth,
            row.itemCount,
            row.totals.planned,
            row.totals.executed,
          ]
        : [row.request.id, row.depth, row.totals.planned, row.totals.executed],
    ),
    [
      ["Total geral", 0, 3, 6, 3],
      ["Plataforma", 1, 2, 5, 2],
      ["API", 2, 1, 3, 2],
      ["api", 3, 3, 2],
      ["platform", 2, 2, 0],
      ["Raiz", 1, 1, 1, 1],
      ["root", 2, 1, 1],
    ],
  );
  assert.deepEqual(rows[0].totals.months, {
    "2026-09": { planned: 3, executed: 1 },
    "2026-10": { planned: 3, executed: 2 },
  });
});

test("journey rows place improvements from unknown collections at root", () => {
  const rows = buildJourneyCollectionRows(
    [],
    [
      {
        id: "orphan",
        collectionId: "missing",
        journeys: [{ month: "2026-09", plannedJourneys: 2 }],
      },
    ],
    ["2026-09"],
  );

  assert.equal(rows[0].name, "Total geral");
  assert.equal(rows[0].totals.planned, 2);
  assert.equal(rows[1].name, "Raiz");
  assert.equal(rows[1].depth, 1);
  assert.equal(rows[2].request.id, "orphan");
  assert.equal(rows[2].depth, 2);
});

test("collapsed journey collections hide only their descendants", () => {
  const rows = buildJourneyCollectionRows(
    [
      { id: "platform", name: "Plataforma", parentId: "" },
      { id: "api", name: "API", parentId: "platform" },
      { id: "support", name: "Suporte", parentId: "" },
    ],
    [
      {
        id: "api-item",
        collectionId: "api",
        journeys: [{ month: "2026-09", plannedJourneys: 1 }],
      },
      {
        id: "support-item",
        collectionId: "support",
        journeys: [{ month: "2026-09", plannedJourneys: 1 }],
      },
    ],
    ["2026-09"],
  );

  const visibleRows = visibleJourneyRows(rows, ["collection:platform"]);

  assert.deepEqual(
    visibleRows.map((row) =>
      row.kind === "collection"
        ? journeyCollectionRowKey(row)
        : `request:${row.request.id}`,
    ),
    [
      "collection:total",
      "collection:platform",
      "collection:support",
      "request:support-item",
    ],
  );
});
