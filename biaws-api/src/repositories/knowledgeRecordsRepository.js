import { randomUUID } from "node:crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getPagination } from "../helpers/query.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextWasProvided,
  resolveKnowledgeContext,
} from "./knowledgeContextRepository.js";
import { assertResourceCollection } from "./resourceCollectionsRepository.js";

export const KNOWLEDGE_RECORD_TYPES = Object.freeze({
  "business-rules": Object.freeze({
    collection: COLLECTION_NAMES.BUSINESS_RULES,
    entityType: "business_rule",
    itemKey: "businessRule",
    label: "Regra de negócio",
    defaultStatus: "draft",
    statuses: ["draft", "active", "retired", "archived"],
  }),
  "architecture-decisions": Object.freeze({
    collection: COLLECTION_NAMES.ARCHITECTURE_DECISIONS,
    entityType: "architecture_decision",
    itemKey: "architectureDecision",
    label: "Decisão arquitetural",
    defaultStatus: "proposed",
    statuses: ["proposed", "accepted", "rejected", "superseded", "archived"],
  }),
});

const REFERENCE_TYPES = new Set(Object.keys(KNOWLEDGE_RECORD_TYPES));
const MAX_REFERENCES = 100;
const MAX_TITLE = 240;
const MAX_RELATIONSHIP = 80;

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function knowledgeRecordConfig(type) {
  const config = KNOWLEDGE_RECORD_TYPES[String(type || "").trim()];
  if (!config) {
    throw httpError(
      404,
      "KNOWLEDGE_RECORD_TYPE_NOT_FOUND",
      `Tipo de conhecimento não suportado: ${type}`,
    );
  }
  return config;
}

function normalizeDocument(document) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

function normalizeDate(value, field, { required = false } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized && !required) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw httpError(
      422,
      "INVALID_KNOWLEDGE_DATE",
      `${field} deve usar YYYY-MM-DD`,
    );
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw httpError(
      422,
      "INVALID_KNOWLEDGE_DATE",
      `${field} contém uma data inválida`,
    );
  }
  return normalized;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeReferences(value, current = []) {
  if (value === undefined) return current || [];
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) {
    throw httpError(
      422,
      "INVALID_KNOWLEDGE_REFERENCES",
      `references deve ser um array com no máximo ${MAX_REFERENCES} itens`,
    );
  }
  const seen = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw httpError(
        422,
        "INVALID_KNOWLEDGE_REFERENCES",
        `references[${index}] é inválida`,
      );
    }
    const targetType = String(entry.targetType || "").trim();
    const targetId = String(entry.targetId || "").trim();
    const relationship = String(entry.relationship || "related").trim();
    if (!REFERENCE_TYPES.has(targetType) || !targetId) {
      throw httpError(
        422,
        "INVALID_KNOWLEDGE_REFERENCES",
        `references[${index}] requer targetType e targetId válidos`,
      );
    }
    if (!relationship || relationship.length > MAX_RELATIONSHIP) {
      throw httpError(
        422,
        "INVALID_KNOWLEDGE_REFERENCES",
        `references[${index}].relationship é inválido`,
      );
    }
    const key = `${targetType}:${targetId}:${relationship}`;
    if (seen.has(key)) {
      throw httpError(
        422,
        "DUPLICATE_KNOWLEDGE_REFERENCE",
        `Referência duplicada: ${key}`,
      );
    }
    seen.add(key);
    return { targetType, targetId, relationship };
  });
}

function normalizePayload(config, payload = {}, current = null) {
  const title = String(payload.title ?? current?.title ?? "").trim();
  const markdown = String(payload.markdown ?? current?.markdown ?? "").trim();
  const status = String(
    payload.status ?? current?.status ?? config.defaultStatus,
  ).trim();
  if (!title || title.length > MAX_TITLE) {
    throw httpError(
      422,
      "INVALID_KNOWLEDGE_RECORD",
      `title é obrigatório e deve ter até ${MAX_TITLE} caracteres`,
    );
  }
  if (!markdown) {
    throw httpError(422, "INVALID_KNOWLEDGE_RECORD", "markdown é obrigatório");
  }
  if (!config.statuses.includes(status)) {
    throw httpError(
      422,
      "INVALID_KNOWLEDGE_STATUS",
      `status inválido: ${status}`,
    );
  }
  const lastReviewedAt = normalizeDate(
    payload.lastReviewedAt ?? current?.lastReviewedAt,
    "lastReviewedAt",
  );
  const reviewChanged =
    lastReviewedAt && lastReviewedAt !== String(current?.lastReviewedAt || "");
  return {
    title,
    markdown,
    status,
    collectionId: String(
      payload.collectionId ?? current?.collectionId ?? "",
    ).trim(),
    references: normalizeReferences(payload.references, current?.references),
    definedAt: normalizeDate(
      payload.definedAt ?? current?.definedAt ?? today(),
      "definedAt",
      { required: true },
    ),
    lastReviewedAt,
    nextReviewAt: normalizeDate(
      payload.nextReviewAt ?? current?.nextReviewAt,
      "nextReviewAt",
    ),
    reviewedBy: String(
      payload.reviewedBy ??
        (reviewChanged ? payload.updatedBy || payload.createdBy : null) ??
        current?.reviewedBy ??
        "",
    ).trim(),
  };
}

export function normalizeKnowledgeRecordPayload(
  type,
  payload = {},
  current = null,
) {
  return normalizePayload(knowledgeRecordConfig(type), payload, current);
}

async function ensureIndexes(db, config) {
  await Promise.all([
    db.collection(config.collection).createIndex({ id: 1 }, { unique: true }),
    db.collection(config.collection).createIndex({
      workspaceId: 1,
      applicationId: 1,
      status: 1,
      updatedAt: -1,
    }),
    db.collection(config.collection).createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
    db
      .collection(config.collection)
      .createIndex({ workspaceId: 1, collectionId: 1, title: 1 }),
    db
      .collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS)
      .createIndex(
        { entityType: 1, entityId: 1, revision: -1 },
        { unique: true },
      ),
    db
      .collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS)
      .createIndex({ entityType: 1, entityId: 1, createdAt: -1 }),
  ]);
}

async function validateReferences(
  db,
  references,
  workspaceId,
  applicationId,
  authorizationScope,
  ownReference = "",
) {
  for (const reference of references) {
    const targetConfig = knowledgeRecordConfig(reference.targetType);
    if (`${reference.targetType}:${reference.targetId}` === ownReference) {
      throw httpError(
        422,
        "SELF_KNOWLEDGE_REFERENCE",
        "Um registro não pode referenciar a si mesmo",
      );
    }
    const target = await db.collection(targetConfig.collection).findOne({
      id: reference.targetId,
      workspaceId,
      applicationId,
      ...(authorizationScope?.workspace === true
        ? {}
        : { applicationId: { $in: authorizationScope?.applicationIds || [] } }),
    });
    if (!target) {
      throw httpError(
        422,
        "KNOWLEDGE_REFERENCE_NOT_FOUND",
        `Referência não encontrada: ${reference.targetType}:${reference.targetId}`,
      );
    }
  }
}

function revisionSnapshot(document) {
  const { _id, ...snapshot } = document;
  return snapshot;
}

async function appendRevision(db, config, document, actor, summary) {
  const revisions = db.collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS);
  const previous = await revisions.findOne(
    { entityType: config.entityType, entityId: document.id },
    { sort: { revision: -1 } },
  );
  const revision = (previous?.revision || 0) + 1;
  await revisions.insertOne({
    id: randomUUID(),
    workspaceId: document.workspaceId,
    applicationId: document.applicationId,
    entityType: config.entityType,
    entityId: document.id,
    revision,
    snapshot: revisionSnapshot(document),
    summary: String(summary || "").trim(),
    createdAt: new Date(),
    createdBy: String(actor || "biaws-api"),
  });
  return revision;
}

function textFilter(search) {
  if (!search) return null;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return {
    $or: [
      { title: { $regex: escaped, $options: "i" } },
      { markdown: { $regex: escaped, $options: "i" } },
    ],
  };
}

export async function listKnowledgeRecords(type, query = {}) {
  const config = knowledgeRecordConfig(type);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db, config);
  const pagination = getPagination(query);
  const conditions = [buildKnowledgeContextFilter(query)];
  const search = String(query.search || "").trim();
  const status = String(query.status || "").trim();
  const collectionId = String(query.collectionId || "").trim();
  if (textFilter(search)) conditions.push(textFilter(search));
  if (status) conditions.push({ status });
  else if (String(query.includeArchived || "") !== "true")
    conditions.push({ status: { $ne: "archived" } });
  if (collectionId) conditions.push({ collectionId });
  const filter =
    conditions.filter((entry) => Object.keys(entry).length).length > 1
      ? { $and: conditions.filter((entry) => Object.keys(entry).length) }
      : conditions.find((entry) => Object.keys(entry).length) || {};
  const collection = db.collection(config.collection);
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .project({ markdown: 0 })
      .sort({ title: 1, id: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      database: db.databaseName,
      collection: config.collection,
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
    items: items.map(normalizeDocument),
  };
}

export async function getKnowledgeRecord(type, id, query = {}) {
  const config = knowledgeRecordConfig(type);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const record = await db
    .collection(config.collection)
    .findOne({ id: String(id), ...buildKnowledgeContextFilter(query) });
  return {
    meta: { database: db.databaseName, collection: config.collection },
    [config.itemKey]: normalizeDocument(record),
  };
}

export async function createKnowledgeRecord(type, payload = {}, query = {}) {
  const config = knowledgeRecordConfig(type);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db, config);
  const context = await resolveKnowledgeContext(db, payload, null, {
    applicationRequired: true,
    authorizationScope: query.authorizationScope,
    create: true,
  });
  const normalized = normalizeKnowledgeRecordPayload(type, payload);
  normalized.collectionId = await assertResourceCollection(
    type,
    normalized.collectionId,
    context.workspaceId,
    query,
  );
  await validateReferences(
    db,
    normalized.references,
    context.workspaceId,
    context.applicationId,
    query.authorizationScope,
  );
  const now = new Date();
  const document = {
    id: randomUUID(),
    ...context,
    ...normalized,
    createdAt: now,
    createdBy: String(payload.createdBy || "biaws-api"),
    updatedAt: now,
    updatedBy: String(payload.createdBy || "biaws-api"),
  };
  await db.collection(config.collection).insertOne(document);
  await appendRevision(
    db,
    config,
    document,
    document.createdBy,
    "Registro criado",
  );
  return getKnowledgeRecord(type, document.id, query);
}

export async function updateKnowledgeRecord(
  type,
  id,
  payload = {},
  query = {},
) {
  const config = knowledgeRecordConfig(type);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = { id: String(id), ...buildKnowledgeContextFilter(query) };
  const current = await db.collection(config.collection).findOne(filter);
  if (!current)
    throw httpError(
      404,
      "KNOWLEDGE_RECORD_NOT_FOUND",
      `${config.label} não encontrada`,
    );
  const normalized = normalizeKnowledgeRecordPayload(type, payload, current);
  const context = knowledgeContextWasProvided(payload)
    ? await resolveKnowledgeContext(db, payload, current, {
        applicationRequired: true,
        authorizationScope: query.authorizationScope,
      })
    : {
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        affectedComponentIds: current.affectedComponentIds || [],
      };
  normalized.collectionId = await assertResourceCollection(
    type,
    normalized.collectionId,
    context.workspaceId,
    query,
  );
  await validateReferences(
    db,
    normalized.references,
    context.workspaceId,
    context.applicationId,
    query.authorizationScope,
    `${type}:${id}`,
  );
  const updatedAt = new Date();
  const updatedBy = String(payload.updatedBy || "biaws-api");
  await db.collection(config.collection).updateOne(filter, {
    $set: { ...context, ...normalized, updatedAt, updatedBy },
  });
  const record = await db
    .collection(config.collection)
    .findOne({ id: String(id), workspaceId: current.workspaceId });
  await appendRevision(
    db,
    config,
    record,
    updatedBy,
    payload.changeSummary || "Registro atualizado",
  );
  return {
    meta: { database: db.databaseName, collection: config.collection },
    [config.itemKey]: normalizeDocument(record),
  };
}

export async function archiveKnowledgeRecord(
  type,
  id,
  payload = {},
  query = {},
) {
  return updateKnowledgeRecord(
    type,
    id,
    {
      ...payload,
      status: "archived",
      changeSummary: payload.changeSummary || "Registro arquivado",
    },
    query,
  );
}

export async function moveKnowledgeRecord(
  type,
  id,
  collectionId,
  payload = {},
  query = {},
) {
  const current = await getKnowledgeRecord(type, id, query);
  const config = knowledgeRecordConfig(type);
  const record = current[config.itemKey];
  if (!record)
    throw httpError(
      404,
      "KNOWLEDGE_RECORD_NOT_FOUND",
      `${config.label} não encontrada`,
    );
  return updateKnowledgeRecord(
    type,
    id,
    {
      ...record,
      collectionId,
      updatedBy: payload.updatedBy,
      changeSummary: "Registro movido entre coleções",
    },
    query,
  );
}

export async function listKnowledgeRevisions(type, id, query = {}) {
  const config = knowledgeRecordConfig(type);
  const current = await getKnowledgeRecord(type, id, query);
  if (!current[config.itemKey])
    throw httpError(
      404,
      "KNOWLEDGE_RECORD_NOT_FOUND",
      `${config.label} não encontrada`,
    );
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const items = await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS)
    .find({ entityType: config.entityType, entityId: String(id) })
    .sort({ revision: -1 })
    .limit(100)
    .toArray();
  return { items: items.map(normalizeDocument) };
}

export async function listKnowledgeObservations(type, id, query = {}) {
  const config = knowledgeRecordConfig(type);
  const current = await getKnowledgeRecord(type, id, query);
  if (!current[config.itemKey])
    throw httpError(
      404,
      "KNOWLEDGE_RECORD_NOT_FOUND",
      `${config.label} não encontrada`,
    );
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const items = await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS)
    .find({ entityType: config.entityType, entityId: String(id) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return { items: items.map(normalizeDocument) };
}

export async function addKnowledgeObservation(
  type,
  id,
  payload = {},
  query = {},
) {
  const config = knowledgeRecordConfig(type);
  const current = await getKnowledgeRecord(type, id, query);
  const record = current[config.itemKey];
  if (!record)
    throw httpError(
      404,
      "KNOWLEDGE_RECORD_NOT_FOUND",
      `${config.label} não encontrada`,
    );
  const markdown = String(payload.markdown || "").trim();
  if (!markdown)
    throw httpError(
      422,
      "INVALID_KNOWLEDGE_OBSERVATION",
      "markdown é obrigatório",
    );
  const document = {
    id: randomUUID(),
    workspaceId: record.workspaceId,
    applicationId: record.applicationId,
    entityType: config.entityType,
    entityId: record.id,
    markdown,
    createdAt: new Date(),
    createdBy: String(payload.createdBy || "biaws-api"),
  };
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS)
    .insertOne(document);
  return { observation: normalizeDocument(document) };
}
