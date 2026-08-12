import assert from "node:assert/strict";
import test from "node:test";

import {
  failedReplicationWorkspaceIds,
  replicateItemsInBulk,
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

test("bulk replication aggregates partial results by destination workspace", async () => {
  const payload = await replicateItemsInBulk({
    destinationWorkspaceIds: ["a", "b"],
    items: [
      { id: "one", name: "Item um" },
      { id: "two", name: "Item dois" },
    ],
    replicateItem: async (item, destinationWorkspaceIds) => ({
      results: destinationWorkspaceIds.map((workspaceId) => ({
        workspace: { id: workspaceId, name: `Workspace ${workspaceId}` },
        status: item.id === "two" && workspaceId === "b" ? "failed" : "created",
      })),
    }),
  });

  assert.deepEqual(payload.summary, { total: 4, succeeded: 3, failed: 1 });
  assert.deepEqual(payload.results, [
    {
      workspace: { id: "a", name: "Workspace a" },
      status: "created",
      message: "2 itens replicados.",
    },
    {
      workspace: { id: "b", name: "Workspace b" },
      status: "failed",
      message: "1 de 2 itens replicados. Falharam: Item dois.",
    },
  ]);
});

test("bulk replication turns an item-level rejection into failures for every destination", async () => {
  const payload = await replicateItemsInBulk({
    destinationWorkspaceIds: ["a", "b"],
    items: [{ id: "one", name: "Sem identificador" }],
    replicateItem: async () => {
      throw new Error("Identificador obrigatório");
    },
    workspaces: [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ],
  });

  assert.deepEqual(payload.summary, { total: 2, succeeded: 0, failed: 2 });
  assert.deepEqual(
    payload.results.map(({ workspace, status, message }) => ({
      workspace,
      status,
      message,
    })),
    [
      {
        workspace: { id: "a", name: "Alpha" },
        status: "failed",
        message:
          "O item não foi replicado. Falharam: Sem identificador. Motivo: Identificador obrigatório.",
      },
      {
        workspace: { id: "b", name: "Beta" },
        status: "failed",
        message:
          "O item não foi replicado. Falharam: Sem identificador. Motivo: Identificador obrigatório.",
      },
    ],
  );
});
