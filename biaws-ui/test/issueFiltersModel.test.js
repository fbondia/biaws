import assert from "node:assert/strict";
import test from "node:test";

import {
  datePeriodRange,
  matchingDatePeriod,
} from "../src/components/issues/IssueFilters/model.js";

test("datePeriodRange creates day and calendar-month presets ending today", () => {
  const today = new Date(2026, 6, 31);

  assert.deepEqual(datePeriodRange({ days: 7 }, today), {
    from: "2026-07-24",
    to: "2026-07-31",
  });
  assert.deepEqual(datePeriodRange({ days: 15 }, today), {
    from: "2026-07-16",
    to: "2026-07-31",
  });
  assert.deepEqual(datePeriodRange({ months: 1 }, today), {
    from: "2026-06-30",
    to: "2026-07-31",
  });
  assert.deepEqual(datePeriodRange({ months: 12 }, today), {
    from: "2025-07-31",
    to: "2026-07-31",
  });
});

test("matchingDatePeriod identifies presets and keeps other ranges custom", () => {
  const today = new Date(2026, 6, 31);

  assert.equal(
    matchingDatePeriod({ from: "2026-07-24", to: "2026-07-31" }, today),
    "1w",
  );
  assert.equal(
    matchingDatePeriod({ from: "2026-04-30", to: "2026-07-31" }, today),
    "3m",
  );
  assert.equal(matchingDatePeriod({ from: "", to: "" }, today), "custom");
});
