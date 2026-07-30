import crypto from "crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getPagination } from "../helpers/query.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { expandTaxonomyIds } from "../helpers/taxonomy.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextWasProvided,
  resolveKnowledgeContext,
} from "./knowledgeContextRepository.js";

const PROCEDURES_COLLECTION = COLLECTION_NAMES.PROCEDURES;
const PROCEDURE_COLLECTIONS_COLLECTION = COLLECTION_NAMES.PROCEDURE_COLLECTIONS;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDocument(document) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

function normalizeStringArray(value, fieldName) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      `Invalid procedure payload: ${fieldName} must be an array`,
    );
  }
  return [
    ...new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  ];
}

function normalizeClassification(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(
      422,
      "Invalid procedure payload: classification must be an object",
    );
  }

  const primaryTaxonomyId = String(value.primaryTaxonomyId || "").trim();
  const secondaryTaxonomyIds = normalizeStringArray(
    value.secondaryTaxonomyIds,
    "classification.secondaryTaxonomyIds",
  ).filter((id) => id !== primaryTaxonomyId);
  const tags = {};

  if (
    value.tags !== undefined &&
    (!value.tags || typeof value.tags !== "object" || Array.isArray(value.tags))
  ) {
    throw createHttpError(
      422,
      "Invalid procedure payload: classification.tags must be an object",
    );
  }

  for (const [groupId, tagIds] of Object.entries(value.tags || {})) {
    const normalizedGroupId = String(groupId || "").trim();
    if (normalizedGroupId) {
      tags[normalizedGroupId] = normalizeStringArray(
        tagIds,
        `classification.tags.${normalizedGroupId}`,
      );
    }
  }

  return { primaryTaxonomyId, secondaryTaxonomyIds, tags };
}

function normalizePayload(payload = {}) {
  const title = String(payload.title || "").trim();
  const summary = String(payload.summary || "").trim();
  const procedure = String(payload.procedure || "").trim();
  if (!title)
    throw createHttpError(422, "Invalid procedure payload: title is required");
  if (!summary)
    throw createHttpError(
      422,
      "Invalid procedure payload: summary is required",
    );
  if (!procedure)
    throw createHttpError(
      422,
      "Invalid procedure payload: procedure is required",
    );

  const normalized = {
    title,
    summary,
    procedure,
    classification: normalizeClassification(payload.classification),
  };

  if (payload.collectionId !== undefined) {
    normalized.collectionId = String(payload.collectionId || "").trim();
  }

  return normalized;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function ensureIndexes(collection) {
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ title: 1 }),
    collection.createIndex({ collectionId: 1 }),
    collection.createIndex({ "classification.primaryTaxonomyId": 1 }),
    collection.createIndex({ "classification.secondaryTaxonomyIds": 1 }),
    collection.createIndex({
      workspaceId: 1,
      applicationId: 1,
      title: 1,
      updatedAt: -1,
    }),
    collection.createIndex({
      workspaceId: 1,
      applicationId: 1,
      updatedAt: -1,
      id: 1,
    }),
    collection.createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
  ]);
}

async function ensureCollectionIndexes(collection) {
  await Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex(
      { workspaceId: 1, parentId: 1, nameKey: 1 },
      { unique: true },
    ),
  ]);
}

function normalizeCollectionName(value) {
  const name = String(value || "").trim();
  if (!name) throw createHttpError(422, "O nome da coleção é obrigatório");
  if (name.length > 120) {
    throw createHttpError(
      422,
      "O nome da coleção deve ter no máximo 120 caracteres",
    );
  }
  return name;
}

async function assertCollectionParent(
  db,
  parentId,
  movingCollectionId = "",
  workspaceId = "",
) {
  if (!parentId) return;
  if (parentId === movingCollectionId) {
    throw createHttpError(
      422,
      "Uma coleção não pode ser movida para dentro dela mesma",
    );
  }

  const collection = db.collection(PROCEDURE_COLLECTIONS_COLLECTION);
  const visited = new Set();
  let currentId = parentId;

  while (currentId) {
    if (visited.has(currentId)) {
      throw createHttpError(
        422,
        "A hierarquia de coleções contém um ciclo inválido",
      );
    }
    if (currentId === movingCollectionId) {
      throw createHttpError(
        422,
        "Uma coleção não pode ser movida para dentro de uma subcoleção própria",
      );
    }

    visited.add(currentId);
    const current = await collection.findOne({
      id: currentId,
      ...(workspaceId ? { workspaceId } : {}),
    });
    if (!current)
      throw createHttpError(
        422,
        `Coleção de procedimentos não encontrada: ${currentId}`,
      );
    currentId = String(current.parentId || "").trim();
  }
}

async function assertCollectionExists(db, collectionId, workspaceId = "") {
  if (!collectionId) return;
  const collection = await db
    .collection(PROCEDURE_COLLECTIONS_COLLECTION)
    .findOne({
      id: collectionId,
      ...(workspaceId ? { workspaceId } : {}),
    });
  if (!collection)
    throw createHttpError(
      422,
      `Coleção de procedimentos não encontrada: ${collectionId}`,
    );
}

function translateDuplicateCollectionError(error) {
  if (error?.code === 11000) {
    throw createHttpError(
      409,
      "Já existe uma coleção com este nome no local selecionado",
    );
  }
  throw error;
}

export async function listProcedures(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURES_COLLECTION);
  await ensureIndexes(collection);
  const pagination = getPagination(query);
  const search = String(query.search || "").trim();
  const searchPattern = escapeRegex(search);
  const requestedTaxonomyIds = String(
    query.taxonomy || query.taxonomyIds || query.taxonomyId || "",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const taxonomyIds = await expandTaxonomyIds(
    db,
    requestedTaxonomyIds,
    query.authorizationScope?.workspaceId || query.workspaceId,
  );
  const tagGroupId = String(query.tagGroupId || "").trim();
  const tagId = String(query.tagId || "").trim();
  const tagFilters = Object.entries(query).flatMap(([key, value]) => {
    if (!key.startsWith("tag_")) return [];
    const groupId = key.slice(4);
    const values = String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length ? [{ groupId, values }] : [];
  });
  if (tagGroupId && tagId)
    tagFilters.push({ groupId: tagGroupId, values: [tagId] });
  if (tagFilters.some(({ groupId }) => /[.$]/u.test(groupId))) {
    throw createHttpError(
      422,
      "Invalid procedure filter: tag group cannot contain '.' or '$'",
    );
  }
  if (tagId && !tagGroupId) {
    throw createHttpError(
      422,
      "Invalid procedure filter: tagGroupId is required when tagId is informed",
    );
  }

  const conditions = [];
  const contextFilter = buildKnowledgeContextFilter(query);
  if (Object.keys(contextFilter).length) conditions.push(contextFilter);
  if (search) {
    conditions.push({
      $or: [
        { title: { $regex: searchPattern, $options: "i" } },
        { summary: { $regex: searchPattern, $options: "i" } },
        { procedure: { $regex: searchPattern, $options: "i" } },
      ],
    });
  }
  if (taxonomyIds.length) {
    conditions.push({
      $or: [
        { "classification.primaryTaxonomyId": { $in: taxonomyIds } },
        { "classification.secondaryTaxonomyIds": { $in: taxonomyIds } },
      ],
    });
  }
  for (const tagFilter of tagFilters) {
    conditions.push({
      [`classification.tags.${tagFilter.groupId}`]:
        tagFilter.values.length === 1
          ? tagFilter.values[0]
          : { $in: tagFilter.values },
    });
  }
  const filter =
    conditions.length > 1 ? { $and: conditions } : conditions[0] || {};
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ title: 1, updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    meta: {
      database: db.databaseName,
      collection: PROCEDURES_COLLECTION,
      page: pagination.page,
      limit: pagination.limit,
      returned: items.length,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      filters: {
        search,
        requestedTaxonomyIds,
        taxonomyIds,
        tags: Object.fromEntries(
          tagFilters.map(({ groupId, values }) => [groupId, values]),
        ),
      },
    },
    items: items.map(normalizeDocument),
  };
}

export async function getProcedure(id, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const procedure = await db.collection(PROCEDURES_COLLECTION).findOne({
    id: String(id),
    ...buildKnowledgeContextFilter(query),
  });
  return {
    meta: { database: db.databaseName, collection: PROCEDURES_COLLECTION },
    procedure: normalizeDocument(procedure),
  };
}

export async function createProcedure(payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURES_COLLECTION);
  await ensureIndexes(collection);
  const normalized = normalizePayload({
    ...payload,
    collectionId: payload.collectionId ?? "",
  });
  const context = await resolveKnowledgeContext(db, payload, null, {
    authorizationScope: query.authorizationScope,
    create: true,
  });
  await assertCollectionExists(
    db,
    normalized.collectionId,
    context.workspaceId,
  );
  const now = new Date();
  const id = crypto.randomUUID();
  await collection.insertOne({
    id,
    ...context,
    ...normalized,
    attachments: [],
    createdAt: now,
    createdBy: payload.createdBy || "biaws-api",
    updatedAt: now,
    updatedBy: payload.createdBy || "biaws-api",
  });
  return getProcedure(id, query);
}

export async function updateProcedure(id, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURES_COLLECTION);
  const current = await collection.findOne({
    id: String(id),
    ...buildKnowledgeContextFilter(query),
  });
  if (!current) throw createHttpError(404, `Procedure not found: ${id}`);
  const normalized = normalizePayload({
    ...payload,
    collectionId: payload.collectionId ?? current.collectionId ?? "",
  });
  if (knowledgeContextWasProvided(payload)) {
    Object.assign(
      normalized,
      await resolveKnowledgeContext(db, payload, current, {
        authorizationScope: query.authorizationScope,
      }),
    );
  }
  await assertCollectionExists(
    db,
    normalized.collectionId,
    current.workspaceId,
  );
  const result = await collection.updateOne(
    { id: String(id), ...buildKnowledgeContextFilter(query) },
    {
      $set: {
        ...normalized,
        updatedAt: new Date(),
        updatedBy: payload.updatedBy || "biaws-ui",
      },
    },
  );
  if (!result.matchedCount)
    throw createHttpError(404, `Procedure not found: ${id}`);
  return getProcedure(id, query);
}

export async function deleteProcedure(id, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const result = await db.collection(PROCEDURES_COLLECTION).deleteOne({
    id: String(id),
    ...buildKnowledgeContextFilter(query),
  });
  if (!result.deletedCount)
    throw createHttpError(404, `Procedure not found: ${id}`);
  return {
    meta: { database: db.databaseName, collection: PROCEDURES_COLLECTION },
    deleted: true,
    id: String(id),
  };
}

export async function listProcedureCollections(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURE_COLLECTIONS_COLLECTION);
  await ensureCollectionIndexes(collection);
  const workspaceId = String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
  const items = await collection
    .find(workspaceId ? { workspaceId } : {})
    .sort({ nameKey: 1, createdAt: 1 })
    .toArray();

  return {
    meta: {
      database: db.databaseName,
      collection: PROCEDURE_COLLECTIONS_COLLECTION,
      total: items.length,
    },
    items: items.map(normalizeDocument),
  };
}

export async function createProcedureCollection(payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURE_COLLECTIONS_COLLECTION);
  await ensureCollectionIndexes(collection);
  const name = normalizeCollectionName(payload.name);
  const parentId = String(payload.parentId || "").trim();
  const workspaceId = String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
  await assertCollectionParent(db, parentId, "", workspaceId);
  const now = new Date();
  const id = crypto.randomUUID();
  const document = {
    id,
    workspaceId,
    name,
    nameKey: name.toLowerCase(),
    parentId,
    createdAt: now,
    createdBy: payload.createdBy || "biaws-api",
    updatedAt: now,
    updatedBy: payload.createdBy || "biaws-api",
  };

  try {
    await collection.insertOne(document);
  } catch (error) {
    translateDuplicateCollectionError(error);
  }

  return {
    meta: {
      database: db.databaseName,
      collection: PROCEDURE_COLLECTIONS_COLLECTION,
    },
    collection: normalizeDocument(document),
  };
}

export async function updateProcedureCollection(id, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURE_COLLECTIONS_COLLECTION);
  await ensureCollectionIndexes(collection);
  const workspaceId = String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
  const current = await collection.findOne({ id: String(id), workspaceId });
  if (!current)
    throw createHttpError(
      404,
      `Coleção de procedimentos não encontrada: ${id}`,
    );
  const name =
    payload.name === undefined
      ? current.name
      : normalizeCollectionName(payload.name);
  const parentId =
    payload.parentId === undefined
      ? String(current.parentId || "").trim()
      : String(payload.parentId || "").trim();
  await assertCollectionParent(db, parentId, String(id), workspaceId);

  try {
    await collection.updateOne(
      { id: String(id), workspaceId },
      {
        $set: {
          name,
          nameKey: name.toLowerCase(),
          parentId,
          updatedAt: new Date(),
          updatedBy: payload.updatedBy || "biaws-ui",
        },
      },
    );
  } catch (error) {
    translateDuplicateCollectionError(error);
  }

  const updated = await collection.findOne({ id: String(id), workspaceId });
  return {
    meta: {
      database: db.databaseName,
      collection: PROCEDURE_COLLECTIONS_COLLECTION,
    },
    collection: normalizeDocument(updated),
  };
}

export async function deleteProcedureCollection(id, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(PROCEDURE_COLLECTIONS_COLLECTION);
  const workspaceId = String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
  const current = await collection.findOne({ id: String(id), workspaceId });
  if (!current)
    throw createHttpError(
      404,
      `Coleção de procedimentos não encontrada: ${id}`,
    );
  const [childCollections, procedures] = await Promise.all([
    collection.countDocuments({ workspaceId, parentId: String(id) }),
    db.collection(PROCEDURES_COLLECTION).countDocuments({
      workspaceId,
      collectionId: String(id),
    }),
  ]);
  if (childCollections || procedures) {
    throw createHttpError(
      409,
      "Somente coleções vazias e sem subcoleções podem ser excluídas",
    );
  }
  await collection.deleteOne({ id: String(id), workspaceId });
  return {
    meta: {
      database: db.databaseName,
      collection: PROCEDURE_COLLECTIONS_COLLECTION,
    },
    collection: normalizeDocument(current),
    deleted: true,
  };
}

export async function moveProcedureToCollection(
  id,
  collectionId,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const normalizedCollectionId = String(collectionId || "").trim();
  const contextFilter = buildKnowledgeContextFilter(query);
  await assertCollectionExists(
    db,
    normalizedCollectionId,
    contextFilter.workspaceId,
  );
  const result = await db.collection(PROCEDURES_COLLECTION).updateOne(
    { id: String(id), ...contextFilter },
    {
      $set: {
        collectionId: normalizedCollectionId,
        updatedAt: new Date(),
        updatedBy: payload.updatedBy || "biaws-ui",
      },
    },
  );
  if (!result.matchedCount)
    throw createHttpError(404, `Procedure not found: ${id}`);
  return getProcedure(id, query);
}
