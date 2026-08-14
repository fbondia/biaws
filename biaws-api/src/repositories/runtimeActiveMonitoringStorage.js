import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

let collectionPromise;

export async function activeMonitorCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(
        COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS,
      );
      await Promise.all([
        collection.createIndex({ id: 1 }, { unique: true }),
        collection.createIndex(
          { workspaceId: 1, runtimeId: 1, nameKey: 1 },
          { unique: true, name: "runtime_active_monitor_name_unique" },
        ),
        collection.createIndex({
          workspaceId: 1,
          applicationId: 1,
          enabled: 1,
          nextRunAt: 1,
        }),
        collection.createIndex(
          {
            workspaceId: 1,
            applicationId: 1,
            deploymentId: 1,
            archivedAt: 1,
            runtimeId: 1,
          },
          { name: "runtime_active_monitor_catalog_filter" },
        ),
        collection.createIndex({
          workspaceId: 1,
          "lease.leasedUntil": 1,
        }),
        collection.createIndex({
          workspaceId: 1,
          applicationId: 1,
          enabled: 1,
          "manualRunRequest.requestedAt": 1,
        }),
      ]);
      return collection;
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

export async function ensureRuntimeActiveMonitoringIndexes() {
  await activeMonitorCollection();
}
