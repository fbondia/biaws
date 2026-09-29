import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
import { demandId, withApi } from "./demandMutationTools.fixtures.js";
for (const [name, args, expected] of [
  [
    "demands_update_specification",
    {
      specificationSections: [{ id: "s1", title: "Scope", content: " **Markdown** ", order: 0 }],
    },
    {
      specification: {
        sections: [{ id: "s1", title: "Scope", content: " **Markdown** ", order: 0 }],
      },
    },
  ],
  [
    "demands_update_checklist",
    {
      checklist: [{ label: " Check ", done: false, date: "", comment: "Pending" }],
    },
    {
      checklist: [{ label: "Check", done: false, date: "", comment: "Pending" }],
    },
  ],
  [
    "demands_update_journeys",
    {
      journeys: [{ month: "2026-09", plannedJourneys: 2, executedJourneys: 1 }],
    },
    {
      journeys: [{ month: "2026-09", plannedJourneys: 2, executedJourneys: 1 }],
    },
  ],
  ["demands_update_specification", { specificationSections: [] }, { specification: { sections: [] } }],
  ["demands_update_checklist", { checklist: [] }, { checklist: [] }],
  ["demands_update_journeys", { journeys: [] }, { journeys: [] }],
] as const) {
  test(`${name} sends an explicit replacement ${JSON.stringify(args)}`, async () => {
    await withApi(async (calls) => {
      const result = await dispatchTool(name, { requestId: demandId, ...args });
      assert.equal(required(result.request).id, demandId);
      assert.equal(calls.length, 2);
      assert.equal(calls[1].method, "PUT");
      assert.deepEqual(calls[1].body, expected);
    });
  });
}
