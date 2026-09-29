import type {
  WorkspaceDocument,
  ApplicationDocument,
} from "../../types/catalog.js";
import { WORKSPACES_COLLECTION, APPLICATIONS_COLLECTION } from "./constants.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

let collectionsPromise: ReturnType<typeof initializeCollections> | undefined;

export async function getCollections() {
  if (!collectionsPromise) {
    collectionsPromise = initializeCollections().catch((error: unknown) => {
      collectionsPromise = undefined;
      throw error;
    });
  }
  return collectionsPromise;
}

async function initializeCollections() {
  const db = await getMongoDatabase();
  const workspaces = db.collection<WorkspaceDocument>(WORKSPACES_COLLECTION);
  const applications = db.collection<ApplicationDocument>(
    APPLICATIONS_COLLECTION,
  );
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
}
