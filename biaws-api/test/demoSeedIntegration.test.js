import assert from "node:assert/strict";
import test from "node:test";

import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "demo seed is workspace-scoped and idempotent",
  { skip: !integrationEnabled },
  async () => {
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB =
      process.env.BIAWS_DEMO_SEED_INTEGRATION_DB ||
      "biaws_demo_seed_integration";

    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const { seedDemoData } = await import("../src/scripts/seedDemo.js");
    const { listRequests } =
      await import("../src/repositories/requestsRepository.js");
    const db = await getMongoDatabase();

    try {
      await db.dropDatabase();
      const first = await seedDemoData();
      const second = await seedDemoData();
      const workspaceId = first.catalog.workspaceId;

      assert.equal(first.taxonomyCreated, true);
      assert.equal(second.taxonomyCreated, false);
      assert.equal(second.issue.created, false);
      assert.equal(second.request.created, false);
      assert.equal(second.request.taskCreated, false);
      assert.equal(second.procedure.created, false);
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.OPTION_LISTS)
          .countDocuments({ workspaceId }),
        6,
      );
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.OPTION_LISTS)
          .countDocuments({ workspaceId: "" }),
        0,
      );
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.TAXONOMIES)
          .countDocuments({ workspaceId }),
        1,
      );
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.PROCEDURE_COLLECTIONS)
          .countDocuments({ workspaceId }),
        1,
      );
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.ISSUES)
          .countDocuments({ workspaceId }),
        1,
      );
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.REQUESTS)
          .countDocuments({ workspaceId }),
        1,
      );
      assert.equal(
        await db
          .collection(COLLECTION_NAMES.PROCEDURES)
          .countDocuments({ workspaceId }),
        1,
      );
      const demands = await listRequests({
        workspaceId,
        page: 1,
        limit: 1,
      });
      assert.deepEqual(
        {
          page: demands.meta.page,
          limit: demands.meta.limit,
          returned: demands.meta.returned,
          total: demands.meta.total,
          totalPages: demands.meta.totalPages,
        },
        { page: 1, limit: 1, returned: 1, total: 1, totalPages: 1 },
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
