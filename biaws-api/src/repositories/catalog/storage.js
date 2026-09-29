import { WORKSPACES_COLLECTION, APPLICATIONS_COLLECTION } from "./constants.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

let collectionsPromise;

export async function getCollections() {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const db = await getMongoDatabase();
      const workspaces = db.collection(WORKSPACES_COLLECTION);
      const applications = db.collection(APPLICATIONS_COLLECTION);
      await Promise.all([
        workspaces.createIndex({ id: 1 }, { unique: true }),
        workspaces.createIndex({ key: 1 }, { unique: true }),
        workspaces.createIndex(
          { default: 1 },
          { unique: true, partialFilterExpression: { default: true } },
        ),
        applications.createIndex({ id: 1 }, { unique: true }),
        applications.createIndex({ workspaceId: 1, key: 1 }, { unique: true }),
        applications.createIndex({
          workspaceId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
        applications.createIndex({ workspaceId: 1, name: 1, id: 1 }),
        applications.createIndex({
          workspaceId: 1,
          collectionId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
      ]);
      return { db, workspaces, applications };
    })().catch((error) => {
      collectionsPromise = undefined;
      throw error;
    });
  }
  return collectionsPromise;
}
