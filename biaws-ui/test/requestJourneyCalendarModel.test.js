import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJourneyBalance,
  filterJourneyCalendar,
  normalizeJourneyMonthCount,
} from "../src/components/requests/JourneyCalendar/model.js";
import { buildJourneyCollectionRows } from "../src/components/requests/requestUtils/journeyCollections.js";

const currentDate = new Date(2026, 0, 31, 23, 59);
const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
const requests = [
  {
    id: "pending",
    collectionId: "child",
    journeys: [
      { month: "2025-11", plannedJourneys: 8, executedJourneys: 0 },
      { month: "2026-01", plannedJourneys: 2, executedJourneys: 2 },
    ],
  },
  {
    id: "balanced",
    collectionId: "parent",
    journeys: [
      { month: "2025-12", plannedJourneys: 3, executedJourneys: 0 },
      { month: "2026-02", plannedJourneys: 0, executedJourneys: 3 },
    ],
  },
  {
    id: "over-executed",
    journeys: [{ month: "2026-02", plannedJourneys: "1", executedJourneys: "4" }],
  },
  {
    id: "outside",
    journeys: [{ month: "2026-03", plannedJourneys: 9 }],
  },
];

test("calendar filters preserve the full period when limits are empty", () => {
  assert.deepEqual(filterJourneyCalendar({ requests, months, currentDate }), {
    requests,
    months,
  });
});

test("calendar period includes boundary months across years and scopes totals", () => {
  const result = filterJourneyCalendar({
    requests,
    months,
    currentDate,
    monthsBefore: 1,
    monthsAfter: 1,
  });
  assert.deepEqual(result.months, ["2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(
    result.requests.map((request) => request.id),
    ["pending", "balanced", "over-executed"],
  );

  const rows = buildJourneyCollectionRows(
    [
      { id: "parent", name: "Plataforma", parentId: "" },
      { id: "child", name: "API", parentId: "parent" },
    ],
    result.requests,
    result.months,
  );
  assert.equal(rows[0].itemCount, 3);
  assert.equal(rows[0].totals.planned, 6);
  assert.equal(rows[0].totals.executed, 9);
  assert.equal(rows.find((row) => row.id === "parent").totals.planned, 5);
  assert.equal(rows.find((row) => row.id === "child").totals.planned, 2);
  assert.equal(requests[0].journeys.length, 2);
});

test("unbalanced calendar filter compares the entire improvement in both directions", () => {
  const result = filterJourneyCalendar({
    requests,
    months,
    currentDate,
    monthsBefore: 1,
    monthsAfter: 1,
    onlyUnbalanced: true,
  });
  assert.deepEqual(
    result.requests.map((request) => request.id),
    ["pending", "over-executed"],
  );
  const rows = buildJourneyCollectionRows([], result.requests, result.months);
  assert.equal(rows[0].itemCount, 2);
  assert.equal(rows[0].totals.planned, 3);
  assert.equal(rows[0].totals.executed, 6);
});

test("zero in both calendar limits selects only the current month", () => {
  const result = filterJourneyCalendar({
    requests,
    months,
    currentDate,
    monthsBefore: 0,
    monthsAfter: 0,
  });
  assert.deepEqual(result.months, ["2026-01"]);
  assert.deepEqual(
    result.requests.map((request) => request.id),
    ["pending"],
  );
});

test("calendar supports one-sided periods and an empty selection", () => {
  assert.deepEqual(filterJourneyCalendar({ months, currentDate, monthsBefore: 0 }).months, [
    "2026-01",
    "2026-02",
    "2026-03",
  ]);
  assert.deepEqual(filterJourneyCalendar({ months, currentDate, monthsAfter: 0 }).months, [
    "2025-11",
    "2025-12",
    "2026-01",
  ]);
  assert.deepEqual(
    filterJourneyCalendar({
      requests,
      months,
      currentDate: new Date(2027, 0, 1),
      monthsBefore: 0,
      monthsAfter: 0,
    }),
    { requests: [], months: [] },
  );
  assert.deepEqual(
    filterJourneyCalendar({
      requests: [{ id: "empty" }, { id: "zero", journeys: [{ month: "2026-01" }] }],
      months,
      currentDate,
    }).requests,
    [],
  );
});

test("calendar month counts are nonnegative whole numbers or unlimited", () => {
  assert.equal(normalizeJourneyMonthCount(""), "");
  assert.equal(normalizeJourneyMonthCount("0"), 0);
  assert.equal(normalizeJourneyMonthCount("12"), 12);
  assert.equal(normalizeJourneyMonthCount("-2"), 0);
  assert.equal(normalizeJourneyMonthCount("2.5"), 2);
  assert.equal(normalizeJourneyMonthCount("invalid"), "");
});

test("journey balance splits the common amount and the pending or excess amount proportionally", () => {
  assert.deepEqual(buildJourneyBalance({ planned: 8, executed: 5 }), {
    planned: 8,
    executed: 5,
    balanced: 5,
    pending: 3,
    excess: 0,
    total: 8,
    segments: [
      { kind: "Balanced", value: 5, percentage: 62.5 },
      { kind: "Pending", value: 3, percentage: 37.5 },
    ],
  });
  assert.deepEqual(buildJourneyBalance({ planned: "3", executed: "5" }).segments, [
    { kind: "Balanced", value: 3, percentage: 60 },
    { kind: "Excess", value: 2, percentage: 40 },
  ]);
  assert.deepEqual(buildJourneyBalance({ planned: 2.5, executed: 1.5 }).segments, [
    { kind: "Balanced", value: 1.5, percentage: 60 },
    { kind: "Pending", value: 1, percentage: 40 },
  ]);
});

test("journey balance uses a single segment for balanced, planned-only or executed-only amounts", () => {
  assert.deepEqual(buildJourneyBalance({ planned: 5, executed: 5 }).segments, [
    { kind: "Balanced", value: 5, percentage: 100 },
  ]);
  assert.deepEqual(buildJourneyBalance({ planned: 4, executed: 0 }).segments, [
    { kind: "Pending", value: 4, percentage: 100 },
  ]);
  assert.deepEqual(buildJourneyBalance({ planned: 0, executed: 4 }).segments, [
    { kind: "Excess", value: 4, percentage: 100 },
  ]);
  assert.deepEqual(buildJourneyBalance().segments, []);
  assert.deepEqual(buildJourneyBalance({ planned: -1, executed: Infinity }).segments, []);
});
