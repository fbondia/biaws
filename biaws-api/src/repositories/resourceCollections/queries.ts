import type { RepositoryQuery } from "../../types/http.js";
import {
  assertResourceCollectionType,
  normalizeDocument,
} from "./normalization.js";
import { collections } from "./storage.js";
import { workspaceId, httpError } from "./support.js";
import {
  APPLICATION_SCOPED_COLLECTION_TYPES,
  RESOURCE_CONFIG,
} from "./constants.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export async function listResourceCollections(
  resourceType: string | string[],
  query: RepositoryQuery = {},
) {
  const type = assertResourceCollectionType(resourceType);
  const { db, collection } = await collections(query);
  let items = await collection
    .find({ workspaceId: workspaceId(query), resourceType: type })
    .sort({ nameKey: 1, id: 1 })
    .toArray();
  const authorizationScope = query.authorizationScope;
  if (
    APPLICATION_SCOPED_COLLECTION_TYPES.has(type) &&
    authorizationScope &&
    authorizationScope.workspace !== true
  ) {
    const collectionIds = await db
      .collection(RESOURCE_CONFIG[type].collection)
      .distinct("collectionId", {
        workspaceId: workspaceId(query),
        applicationId: {
          $in: (authorizationScope.applicationIds || []).map(String),
        },
      });
    const byId = new Map(items.map((item) => [item.id, item]));
    const visibleIds = new Set();
    for (const collectionId of collectionIds.filter(Boolean)) {
      let currentId = collectionId;
      while (currentId && !visibleIds.has(currentId)) {
        visibleIds.add(currentId);
        currentId = String(byId.get(currentId)?.parentId || "");
      }
    }
    items = items.filter((item) => visibleIds.has(item.id));
  }
  return {
    meta: {
      database: db.databaseName,
      collection: COLLECTION_NAMES.RESOURCE_COLLECTIONS,
      resourceType: type,
      total: items.length,
    },
    items: items.map(normalizeDocument),
  };
}

export async function assertResourceCollection(
  resourceType: string,
  collectionId: string,
  currentWorkspaceId: string | null | undefined,
  query: RepositoryQuery = {},
) {
  const type = assertResourceCollectionType(resourceType);
  const normalizedId = String(collectionId || "").trim();
  if (!normalizedId) return "";
  const { collection } = await collections(query);
  const exists = await collection.countDocuments(
    {
      id: normalizedId,
      workspaceId: String(currentWorkspaceId),
      resourceType: type,
    },
    { limit: 1 },
  );
  if (!exists) {
    throw httpError(422, "COLLECTION_NOT_FOUND", "Coleção não encontrada");
  }
  return normalizedId;
}
