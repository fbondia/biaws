import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REPLICATION_WORKSPACES,
  normalizeReplicationDestinations,
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../src/services/workspaceReplicationService.js";

test("replication destinations support batches, remove duplicates and preserve legacy calls", () => {
  assert.deepEqual(
    normalizeReplicationDestinations(
      { destinationWorkspaceIds: [" target-b ", "target-a", "target-b"] },
      "source",
    ),
    {
      destinationWorkspaceIds: ["target-b", "target-a"],
      legacyRequest: false,
    },
  );
  assert.deepEqual(
    normalizeReplicationDestinations(
      { destinationWorkspaceId: "target-a" },
      "source",
    ),
    { destinationWorkspaceIds: ["target-a"], legacyRequest: true },
  );
});

test("replication destinations reject the source workspace and excessive batches", () => {
  assert.throws(
    () =>
      normalizeReplicationDestinations(
        { destinationWorkspaceIds: ["source"] },
        "source",
      ),
    (error) => error.code === "SAME_WORKSPACE_REPLICATION",
  );
  assert.throws(
    () =>
      normalizeReplicationDestinations(
        {
          destinationWorkspaceIds: Array.from(
            { length: MAX_REPLICATION_WORKSPACES + 1 },
            (_, index) => `workspace-${index}`,
          ),
        },
        "source",
      ),
    (error) => error.code === "TOO_MANY_DESTINATION_WORKSPACES",
  );
});

test("multi-workspace replication returns success and authorization failure per target", async () => {
  const actor = {
    userId: "user-1",
    workspaceId: "source",
    workspaces: [
      { id: "source", name: "Source" },
      { id: "allowed", name: "Allowed" },
      { id: "forbidden", name: "Forbidden" },
    ],
  };
  const batch = await replicateAcrossWorkspaces({
    actor,
    forbiddenCode: "DESTINATION_FORBIDDEN",
    forbiddenMessage: "Sem permissão no destino",
    payload: { destinationWorkspaceIds: ["allowed", "forbidden"] },
    permission: "documents.create",
    resourceType: "document",
    resolveAuthorization: async (_userId, workspaceId) => ({
      workspaceId,
      workspaces: actor.workspaces,
      permissions: workspaceId === "allowed" ? ["documents.create"] : [],
      permissionScopes:
        workspaceId === "allowed"
          ? { "documents.create": { workspace: true, applicationIds: [] } }
          : {},
    }),
    replicate: async ({ destinationWorkspaceId }) => ({
      resource: { id: `copy-${destinationWorkspaceId}`, type: "document" },
      status: "created",
    }),
  });

  assert.deepEqual(batch.summary, { total: 2, succeeded: 1, failed: 1 });
  assert.equal(batch.results[0].status, "created");
  assert.equal(batch.results[1].status, "failed");
  assert.equal(batch.results[1].error.code, "DESTINATION_FORBIDDEN");
  assert.equal(batch.results[1].error.statusCode, 403);
});

test("legacy replication keeps the original top-level response contract", () => {
  const response = {
    statusCode: 200,
    payload: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
    },
  };
  sendReplicationResponse(response, {
    legacyRequest: true,
    results: [
      {
        data: { document: { id: "document-copy" } },
        status: "created",
        workspace: { id: "target", name: "Target" },
      },
    ],
    summary: { total: 1, succeeded: 1, failed: 0 },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.document.id, "document-copy");
  assert.equal(response.payload.destinationWorkspace.id, "target");
  assert.equal(response.payload.results[0].data, undefined);
});
