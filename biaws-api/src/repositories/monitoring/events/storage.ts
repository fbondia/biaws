import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

let collectionPromise: ReturnType<typeof initializeCollections> | undefined;

export async function monitoringCollection() {
  collectionPromise ??= initializeCollections().catch((error: unknown) => {
    collectionPromise = undefined;
    throw error;
  });
  return collectionPromise;
}

async function initializeCollections() {
  const database = await getMongoDatabase();
  const collection = database.collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS);
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "monitoring_expiration" }),
    collection.createIndex(
      { workspaceId: 1, runtimeId: 1, signalId: 1 },
      {
        unique: true,
        partialFilterExpression: { signalId: { $type: "string" } },
      },
    ),
    collection.createIndex({
      workspaceId: 1,
      applicationId: 1,
      runtimeId: 1,
      observedAt: -1,
      receivedAt: -1,
    }),
  ]);
  return collection;
}
