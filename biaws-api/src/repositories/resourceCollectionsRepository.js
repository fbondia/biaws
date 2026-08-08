import { randomUUID } from "node:crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

export const RESOURCE_COLLECTION_TYPES = Object.freeze([
  "applications",
  "architecture-decisions",
  "business-rules",
  "demands",
  "secrets",
  "skills",
  "servers",
]);

const RESOURCE_CONFIG = Object.freeze({
  applications: {
    collection: COLLECTION_NAMES.APPLICATIONS,
    label: "aplicações",
  },
  "architecture-decisions": {
    collection: COLLECTION_NAMES.ARCHITECTURE_DECISIONS,
    label: "decisões arquiteturais",
  },
  "business-rules": {
    collection: COLLECTION_NAMES.BUSINESS_RULES,
    label: "regras de negócio",
  },
  demands: { collection: COLLECTION_NAMES.REQUESTS, label: "melhorias" },
  secrets: { collection: COLLECTION_NAMES.SECRETS, label: "segredos" },
  skills: { collection: COLLECTION_NAMES.SKILLS, label: "skills" },
  servers: { collection: COLLECTION_NAMES.SERVERS, label: "servidores" },
});

const APPLICATION_SCOPED_COLLECTION_TYPES = new Set([
  "architecture-decisions",
  "business-rules",
  "demands",
]);

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeDocument(document) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

function workspaceId(query = {}) {
  return String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
}

export function assertResourceCollectionType(resourceType) {
  const type = String(resourceType || "").trim();
  if (!RESOURCE_CONFIG[type]) {
    throw httpError(
      404,
      "RESOURCE_COLLECTION_TYPE_NOT_FOUND",
      `Tipo de coleção não suportado: ${type}`,
    );
  }
  return type;
}

function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name) {
    throw httpError(
      422,
      "INVALID_COLLECTION",
      "O nome da coleção é obrigatório",
    );
  }
  if (name.length > 120) {
    throw httpError(
      422,
      "INVALID_COLLECTION",
      "O nome da coleção deve ter no máximo 120 caracteres",
    );
  }
  return name;
}

async function collections(query = {}) {
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

async function assertParent(
  collection,
  { parentId, movingId = "", workspaceId: currentWorkspaceId, resourceType },
) {
  if (!parentId) return;
  if (parentId === movingId) {
    throw httpError(
      422,
      "INVALID_COLLECTION_PARENT",
      "Uma coleção não pode ser movida para dentro dela mesma",
    );
  }
  const visited = new Set();
  let currentId = parentId;
  while (currentId) {
    if (visited.has(currentId) || currentId === movingId) {
      throw httpError(
        422,
        "INVALID_COLLECTION_PARENT",
        "Uma coleção não pode ser movida para dentro de uma subcoleção própria",
      );
    }
    visited.add(currentId);
    const current = await collection.findOne({
      id: currentId,
      workspaceId: currentWorkspaceId,
      resourceType,
    });
    if (!current) {
      throw httpError(
        422,
        "COLLECTION_PARENT_NOT_FOUND",
        `Coleção pai não encontrada: ${currentId}`,
      );
    }
    currentId = String(current.parentId || "").trim();
  }
}

function duplicateError(error) {
  if (error?.code === 11000) {
    throw httpError(
      409,
      "COLLECTION_NAME_CONFLICT",
      "Já existe uma coleção com este nome no local selecionado",
    );
  }
  throw error;
}

export async function listResourceCollections(resourceType, query = {}) {
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

export async function createResourceCollection(
  resourceType,
  payload = {},
  query = {},
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
  resourceType,
  id,
  payload = {},
  query = {},
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

export async function deleteResourceCollection(resourceType, id, query = {}) {
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

export async function assertResourceCollection(
  resourceType,
  collectionId,
  currentWorkspaceId,
  query = {},
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
