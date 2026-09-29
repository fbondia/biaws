import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { withApi } from "./apiCoverageTools.fixtures.js";
test("invalid inputs never reach HTTP", async () => {
  await withApi(null, async (calls) => {
    for (const [name, args] of [
      ["audit_events_list", { entityType: "unknown", entityId: "id" }],
      [
        "audit_events_list",
        { entityType: "issue", entityId: "id", limit: 201 },
      ],
      ["audit_events_list", { entityType: "issue", entityId: " " }],
      ["documents_list_revisions", { documentId: " " }],
      ["documents_list_observations", { documentId: "doc", page: 1 }],
      ["monitoring_runtime_targets_list", { workspaceId: "other" }],
      [
        "runtime_monitoring_signals_list",
        { runtimeReference: "r", limit: 101 },
      ],
      [
        "runtime_monitoring_signals_list",
        { runtimeReference: "r", status: "invalid" },
      ],
      ["applications_monitoring_health_get", { applicationId: " " }],
      ["issues_update", { issueId: "i" }],
      ["issues_update", { issueId: "i", title: " " }],
      ["issues_update", { issueId: "i", affectedComponentIds: ["a", " a "] }],
      ["issues_update", { issueId: "i", affectedComponentIds: [" "] }],
      ["issues_update", { issueId: "i", status: "invalid" }],
      ["issues_update", { issueId: "i", source: {} }],
    ] as const)
      await assert.rejects(dispatchTool(name, args));
    assert.equal(calls.length, 0);
  });
});
