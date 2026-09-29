import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

let collectionPromise;

export async function getCollections() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const db = await getMongoDatabase();
      const secrets = db.collection(COLLECTION_NAMES.SECRETS);
      await Promise.all([
        secrets.createIndex({ id: 1 }, { unique: true }),
        secrets.createIndex(
          { workspaceId: 1, applicationId: 1, normalizedName: 1 },
          { unique: true },
        ),
        secrets.createIndex(
          { workspaceId: 1, identifier: 1 },
          {
            unique: true,
            partialFilterExpression: { identifier: { $type: "string" } },
          },
        ),
        secrets.createIndex({ workspaceId: 1, status: 1, name: 1, id: 1 }),
        secrets.createIndex({ workspaceId: 1, collectionId: 1 }),
      ]);
      return {
        db,
        secrets,
        applications: db.collection(COLLECTION_NAMES.APPLICATIONS),
      };
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}
