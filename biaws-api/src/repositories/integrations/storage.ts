import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import type { IntegrationDocument } from "../../types/topology.js";

let collectionPromise: ReturnType<typeof initializeCollections> | undefined;

export async function getCollection() {
  collectionPromise ??= initializeCollections();
  return collectionPromise;
}

async function initializeCollections() {
  const database = await getMongoDatabase();
  const collection = database.collection<IntegrationDocument>(COLLECTION_NAMES.APPLICATION_INTEGRATIONS);
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ workspaceId: 1, applicationId: 1, key: 1 }, { unique: true }),
    collection.createIndex({ workspaceId: 1, applicationId: 1, targetApplicationId: 1 }, { unique: true }),
    collection.createIndex({
      workspaceId: 1,
      targetApplicationId: 1,
      status: 1,
    }),
  ]);
  return collection;
}
