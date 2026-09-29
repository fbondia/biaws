import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { demandId, withApi } from "./demandMutationTools.fixtures.js";
test("invalid input is rejected before any HTTP call", async () => {
  await withApi(async (calls) => {
    const cases = [
      ["demands_update", {}],
      ["demands_update", { title: "   " }],
      ["demands_update", { specification: {} }],
      ["demands_update", { estimatedJourneys: -1 }],
      ["demands_update_note", { noteId: "note/1", content: " " }],
      ["demands_delete_note", { noteId: " " }],
      [
        "demands_update_specification",
        {
          specificationSections: [
            { id: "a", title: "A", content: "", order: 0 },
            { id: "a", title: "B", content: "", order: 1 },
          ],
        },
      ],
      [
        "demands_update_checklist",
        {
          checklist: [
            { label: " A ", done: false },
            { label: "A", done: true },
          ],
        },
      ],
      [
        "demands_update_journeys",
        { journeys: [{ month: "2026-13", plannedJourneys: 1 }] },
      ],
      [
        "demands_update_journeys",
        {
          journeys: [
            { month: "2026-09", plannedJourneys: 1 },
            { month: "2026-09", plannedJourneys: 2 },
          ],
        },
      ],
    ] as const;
    for (const [name, args] of cases)
      await assert.rejects(
        dispatchTool(name, { requestId: demandId, ...args }),
      );
    assert.equal(calls.length, 0);
  });
});

test("missing notes and journey months outside the period never mutate", async () => {
  await withApi(async (calls) => {
    await assert.rejects(
      dispatchTool("demands_delete_note", {
        requestId: demandId,
        noteId: "missing",
      }),
      /note not found/u,
    );
    await assert.rejects(
      dispatchTool("demands_update_journeys", {
        requestId: demandId,
        journeys: [{ month: "2026-08", plannedJourneys: 1 }],
      }),
      /startDate\/endDate/u,
    );
    assert.ok(calls.every((call) => call.method === "GET"));
  });
});
