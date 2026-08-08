import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRequest } from "../src/components/requests/requestUtils/normalization.js";

test("request normalization maps legacy billing to the journey model", () => {
  const request = normalizeRequest({
    id: "improvement-1",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    billing: [
      {
        month: "2026-07",
        plannedJourneys: 8,
        billedJourneys: 6,
      },
    ],
  });

  assert.deepEqual(request.journeys, [
    {
      month: "2026-07",
      plannedJourneys: 8,
      executedJourneys: 6,
      comment: "",
    },
  ]);
});

test("request normalization preserves its improvement collection", () => {
  const request = normalizeRequest({
    id: "improvement-2",
    collectionId: "roadmap/platform",
  });

  assert.equal(request.collectionId, "roadmap/platform");
});
