import type { RepositoryQuery } from "../../types/http.js";
import {
  assertResourceCollectionType,
  normalizeName,
  normalizeDocument,
} from "./normalization.js";
import { workspaceId, duplicateError, httpError } from "./support.js";
import { collections } from "./storage.js";
import { assertParent } from "./context.js";
import { RESOURCE_CONFIG } from "./constants.js";
import { randomUUID } from "node:crypto";

export async function createResourceCollection(
  resourceType: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const type = assertResourceCollectionType(resourceType);
  const name = normalizeName(payload.name);
  const parentId = String(payload.parentId || "").trim();
  const currentWorkspaceId = workspaceId(query);
  const { collection } = await collections(query);
  await assertParent(collection, {
    parentId,
    workspaceId: currentWorkspaceId,
    resourceType: type,
  });
  const now = new Date();
  const document = {
    id: randomUUID(),
    workspaceId: currentWorkspaceId,
    resourceType: type,
    name,
    nameKey: name.toLocaleLowerCase("pt-BR"),
    parentId,
    createdAt: now,
    createdBy: String(payload.createdBy || ""),
    updatedAt: now,
    updatedBy: String(payload.createdBy || ""),
  };
  try {
    await collection.insertOne(document);
  } catch (error) {
    duplicateError(error);
  }
  return { collection: normalizeDocument(document) };
}

export async function updateResourceCollection(
  resourceType: string | string[],
  id: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const type = assertResourceCollectionType(resourceType);
  const currentWorkspaceId = workspaceId(query);
  const { collection } = await collections(query);
  const current = await collection.findOne({
    id: String(id),
    workspaceId: currentWorkspaceId,
    resourceType: type,
  });
  if (!current) {
    throw httpError(404, "COLLECTION_NOT_FOUND", "Coleção não encontrada");
  }
  const name = Object.hasOwn(payload, "name")
    ? normalizeName(payload.name)
    : current.name;
  const parentId = Object.hasOwn(payload, "parentId")
    ? String(payload.parentId || "").trim()
    : String(current.parentId || "");
  await assertParent(collection, {
    parentId,
    movingId: current.id,
    workspaceId: currentWorkspaceId,
    resourceType: type,
  });
  try {
    await collection.updateOne(
      { id: current.id, workspaceId: currentWorkspaceId, resourceType: type },
      {
        $set: {
          name,
          nameKey: name.toLocaleLowerCase("pt-BR"),
          parentId,
          updatedAt: new Date(),
          updatedBy: String(payload.updatedBy || ""),
        },
      },
    );
  } catch (error) {
    duplicateError(error);
  }
  return {
    collection: normalizeDocument(
      await collection.findOne({
        id: current.id,
        workspaceId: currentWorkspaceId,
      }),
    ),
  };
}

export async function deleteResourceCollection(
  resourceType: string | string[],
  id: string | string[],
  query: RepositoryQuery = {},
) {
  const type = assertResourceCollectionType(resourceType);
  const currentWorkspaceId = workspaceId(query);
  const { db, collection } = await collections(query);
  const current = await collection.findOne({
    id: String(id),
    workspaceId: currentWorkspaceId,
    resourceType: type,
  });
  if (!current) {
    throw httpError(404, "COLLECTION_NOT_FOUND", "Coleção não encontrada");
  }
  const [children, resources] = await Promise.all([
    collection.countDocuments({
      workspaceId: currentWorkspaceId,
      resourceType: type,
      parentId: current.id,
    }),
    db.collection(RESOURCE_CONFIG[type].collection).countDocuments({
      workspaceId: currentWorkspaceId,
      collectionId: current.id,
    }),
  ]);
  if (children || resources) {
    throw httpError(
      409,
      "COLLECTION_NOT_EMPTY",
      `A coleção só pode ser excluída quando não tiver subcoleções nem ${RESOURCE_CONFIG[type].label}`,
    );
  }
  await collection.deleteOne({
    id: current.id,
    workspaceId: currentWorkspaceId,
    resourceType: type,
  });
  return { collection: normalizeDocument(current) };
}
