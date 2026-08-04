import assert from "node:assert/strict";
import test from "node:test";

import { useRequestDraftActions } from "../src/components/requests/RequestsView/hooks/useRequestDraftActions.js";

function createHarness() {
  const selectedRequest = {
    id: "request-1",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    checklist: [],
    journeys: [
      {
        month: "2026-08",
        plannedJourneys: 1,
        executedJourneys: 0,
        comment: "",
      },
    ],
  };
  const updates = [];
  const persisted = [];

  const actions = useRequestDraftActions({
    numberDrafts: {},
    schedulePersistRequest: (request) => persisted.push(request),
    selectedRequest,
    setChecklistDialogLabel() {},
    setNumberDrafts(updater) {
      updater({});
    },
    setRequestError() {},
    updateRequest(requestId, updater) {
      updates.push({ requestId, request: updater(selectedRequest) });
    },
    updateSelectedField() {},
  });

  return { actions, persisted, updates };
}

test("committing monthly journeys updates and schedules persistence", () => {
  const { actions, persisted, updates } = createHarness();

  actions.commitJourneyMonth("2026-08", "plannedJourneys", "2.5");

  assert.equal(updates.length, 1);
  assert.equal(updates[0].requestId, "request-1");
  assert.equal(updates[0].request.journeys[0].plannedJourneys, 2.5);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].journeys[0].plannedJourneys, 2.5);
});

test("editing a journey comment schedules persistence", () => {
  const { actions, persisted, updates } = createHarness();

  actions.updateJourneyComment("2026-08", "Execução iniciada");

  assert.equal(updates[0].request.journeys[0].comment, "Execução iniciada");
  assert.equal(persisted[0].journeys[0].comment, "Execução iniciada");
});
