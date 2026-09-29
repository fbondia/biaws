import type { RepositoryQuery } from "../../types/http.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

export async function collections(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(COLLECTION_NAMES.RESOURCE_COLLECTIONS);
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex(
      { workspaceId: 1, resourceType: 1, parentId: 1, nameKey: 1 },
      { unique: true },
    ),
  ]);
  return { db, collection };
}
