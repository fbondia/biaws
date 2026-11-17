import assert from "node:assert/strict";
import test from "node:test";

import { closeMongoClient, getMongoDatabase } from "../../src/helpers/mongoClient.js";
import { listIssues } from "../../src/repositories/issues/index.js";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";

const mongoUri = process.env.BIAWS_INTEGRATION_MONGO_URI;

test(
  "listing matches both issue codes and sorts paginated results by the displayed code",
  { skip: !mongoUri },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = mongoUri;
    process.env.MONGO_DB = isolatedDatabaseName();
    const db = await getMongoDatabase();
    const query = { workspaceId: "test-workspace" };
    const firstId = "2026-11-16-001";
    const secondId = "2026-11-16-002";
    const thirdId = "2026-11-16-003";

    try {
      await db.collection("issues").insertMany([
        { id: firstId, identifier: "xxx", workspaceId: query.workspaceId },
        { id: secondId, workspaceId: query.workspaceId },
        { id: thirdId, identifier: null, workspaceId: query.workspaceId },
        { id: "other-issue", identifier: "xxx", workspaceId: "other-workspace" },
      ]);

      for (const codigo of ["XX", firstId]) {
        const result = await listIssues({ ...query, codigo, sort: "code" });
        assert.deepEqual(
          result.items.map(({ id }) => id),
          [firstId],
        );
        assert.equal(result.meta.total, 1);
      }

      const firstPage = await listIssues({ ...query, sort: "code", limit: 2 });
      const secondPage = await listIssues({ ...query, sort: "code", limit: 2, page: 2 });
      const descending = await listIssues({ ...query, sort: "-code", limit: 1 });
      const byId = await listIssues({ ...query, sort: "id", limit: 1 });
      assert.deepEqual(
        firstPage.items.map(({ id }) => id),
        [secondId, thirdId],
      );
      assert.deepEqual(
        secondPage.items.map(({ id }) => id),
        [firstId],
      );
      assert.deepEqual(
        descending.items.map(({ id }) => id),
        [firstId],
      );
      assert.deepEqual(
        byId.items.map(({ id }) => id),
        [firstId],
      );
    } finally {
      await db.dropDatabase().finally(closeMongoClient);
    }
  },
);
