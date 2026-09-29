import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

let collectionPromise: ReturnType<typeof initializeCollections> | undefined;

export async function preferencesCollection() {
  if (!collectionPromise) {
    collectionPromise = initializeCollections().catch((error: unknown) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

async function initializeCollections() {
  const database = await getMongoDatabase();
  const collection = database.collection(COLLECTION_NAMES.USER_PREFERENCES);
  await Promise.all([
    collection.createIndex(
      { workspaceId: 1, userId: 1 },
      { unique: true, name: "workspace_user_preferences_unique" },
    ),
    collection.createIndex({ workspaceId: 1, updatedAt: -1 }),
  ]);
  return collection;
}
