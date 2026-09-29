import { COLLECTION } from "./constants.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

let indexesPromise;

export async function diagramsCollection() {
  const database = await getMongoDatabase();
  const collection = database.collection(COLLECTION);
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      collection.createIndex({ id: 1 }, { unique: true }),
      collection.createIndex(
        { workspaceId: 1, applicationId: 1, normalizedName: 1 },
        { unique: true },
      ),
      collection.createIndex({
        workspaceId: 1,
        applicationId: 1,
        updatedAt: -1,
        id: 1,
      }),
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }
  await indexesPromise;
  return collection;
}
