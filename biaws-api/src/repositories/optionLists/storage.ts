import type { OptionList } from "../../types/catalog.js";
import type { RepositoryQuery } from "../../types/http.js";
import { OPTION_LISTS_COLLECTION, DEFAULT_OPTION_LISTS } from "./constants.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

export async function getCollection(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection<OptionList>(OPTION_LISTS_COLLECTION);
  const workspaceId = String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
  await collection.createIndex({ workspaceId: 1, key: 1 }, { unique: true });
  const now = new Date();
  await Promise.all(
    DEFAULT_OPTION_LISTS.map((list) =>
      collection.updateOne(
        { workspaceId, key: list.key },
        {
          $setOnInsert: {
            ...list,
            items: list.items.map((item) => ({
              ...item,
              value: String(item.value),
              label: String(item.label),
            })),
            workspaceId,
            createdAt: now,
            updatedAt: now,
            version: 1,
          },
        },
        { upsert: true },
      ),
    ),
  );
  return { db, collection, workspaceId };
}
