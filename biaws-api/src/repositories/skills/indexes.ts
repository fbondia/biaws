import { Collection, Document } from "mongodb";

export async function ensureIndexes<T extends Document>(collection: Collection<T>) {
  await Promise.all([
    collection.createIndex({ workspaceId: 1, skillId: 1, version: 1 }, { unique: true }),
    collection.createIndex({ workspaceId: 1, skillId: 1, createdAt: -1 }),
    collection.createIndex({ workspaceId: 1, status: 1 }),
    collection.createIndex({ workspaceId: 1, collectionId: 1 }),
  ]);
}
