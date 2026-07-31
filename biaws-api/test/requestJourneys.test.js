import assert from "node:assert/strict";
import test from "node:test";

import { normalizeJourneyPeriods } from "../src/repositories/requestsRepository.js";

test("journey periods expose planned and executed journeys", () => {
  const periods = normalizeJourneyPeriods(
    [
      {
        month: "2026-07",
        plannedJourneys: 4,
        executedJourneys: 3,
        comment: "Execução parcial",
      },
    ],
    "2026-07-01",
    "2026-08-31",
  );

  assert.deepEqual(periods, [
    {
      month: "2026-07",
      plannedJourneys: 4,
      executedJourneys: 3,
      comment: "Execução parcial",
    },
    {
      month: "2026-08",
      plannedJourneys: 0,
      executedJourneys: 0,
      comment: "",
    },
  ]);
});

test("journey periods accept legacy billing fields without returning them", () => {
  const [period] = normalizeJourneyPeriods(
    [
      {
        month: "2026-07",
        journeys: 5,
        billedJourneys: 2,
      },
    ],
    "2026-07-01",
    "2026-07-31",
  );

  assert.deepEqual(period, {
    month: "2026-07",
    plannedJourneys: 5,
    executedJourneys: 2,
    comment: "",
  });
  assert.equal(Object.hasOwn(period, "billedJourneys"), false);
  assert.equal(Object.hasOwn(period, "journeys"), false);
});
