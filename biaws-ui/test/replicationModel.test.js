import assert from "node:assert/strict";
import test from "node:test";

import {
  failedReplicationWorkspaceIds,
  replicationTargets,
} from "../src/components/shared/replicationModel.js";

test("replication targets exclude the source and archived workspaces", () => {
  assert.deepEqual(
    replicationTargets(
      [
        { id: "source", name: "Origem" },
        { id: "b", name: "Zulu" },
        { id: "archived", name: "Antigo", status: "archived" },
        { id: "a", name: "Alpha" },
      ],
      "source",
    ).map(({ id }) => id),
    ["a", "b"],
  );
});

test("failed replication ids support retrying only failed destinations", () => {
  assert.deepEqual(
    failedReplicationWorkspaceIds([
      { workspace: { id: "a" }, status: "created" },
      { workspace: { id: "b" }, status: "failed" },
      { workspace: { id: "c" }, status: "replaced" },
      { workspace: { id: "d" }, status: "failed" },
    ]),
    ["b", "d"],
  );
});
