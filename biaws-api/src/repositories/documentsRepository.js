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
import { assertTaxonomyIdsApplicable } from "../helpers/taxonomy.js";

export const DOCUMENT_TYPES = Object.freeze({
  "business-rule": Object.freeze({
    label: "Regra de negócio",
    defaultStatus: "draft",
    statuses: ["draft", "active", "retired", "archived"],
    currentStatuses: ["active"],
    applicationRequired: true,
  }),
  "architecture-decision": Object.freeze({
    label: "Decisão arquitetural",
    defaultStatus: "proposed",
    statuses: ["proposed", "accepted", "rejected", "superseded", "archived"],
    currentStatuses: ["accepted"],
    applicationRequired: true,
  }),
  guideline: Object.freeze({
    label: "Guideline",
    defaultStatus: "draft",
    statuses: ["draft", "published", "deprecated", "archived"],
    currentStatuses: ["published"],
    applicationRequired: false,
  }),
  feature: Object.freeze({
    label: "Feature",
    defaultStatus: "draft",
    statuses: ["draft", "published", "deprecated", "archived"],
    currentStatuses: ["published"],
    applicationRequired: true,
  }),
  "technical-reference": Object.freeze({
    label: "Referência técnica",
    defaultStatus: "draft",
    statuses: ["draft", "published", "deprecated", "archived"],
    currentStatuses: ["published"],
    applicationRequired: false,
  }),
  procedure: Object.freeze({
    label: "Procedimento",
    defaultStatus: "draft",
    statuses: ["draft", "published", "deprecated", "archived"],
    currentStatuses: ["published"],
    applicationRequired: false,
  }),
});

const MAX_REFERENCES = 100;
const MAX_RELATIONSHIP = 80;
const MAX_TITLE = 240;
const MAX_SUMMARY = 500;

function normalizeStringArray(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_CLASSIFICATION",
      `${field} deve ser um array`,
    );
  }
  return [
    ...new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  ];
}

function normalizeClassification(value, current = {}) {
  const classification = value === undefined ? current || {} : value;
  if (
    !classification ||
    typeof classification !== "object" ||
    Array.isArray(classification)
  ) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_CLASSIFICATION",
      "classification deve ser um objeto",
    );
  }
  const primaryTaxonomyId = String(
    classification.primaryTaxonomyId || "",
  ).trim();
  const secondaryTaxonomyIds = normalizeStringArray(
    classification.secondaryTaxonomyIds,
    "classification.secondaryTaxonomyIds",
  ).filter((id) => id !== primaryTaxonomyId);
  if (
    classification.tags !== undefined &&
    (!classification.tags ||
      typeof classification.tags !== "object" ||
      Array.isArray(classification.tags))
  ) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_CLASSIFICATION",
      "classification.tags deve ser um objeto",
    );
  }
  const tags = Object.fromEntries(
    Object.entries(classification.tags || {}).flatMap(([groupId, tagIds]) => {
      const normalizedGroupId = String(groupId || "").trim();
      return normalizedGroupId
        ? [
            [
              normalizedGroupId,
              normalizeStringArray(
                tagIds,
                `classification.tags.${normalizedGroupId}`,
              ),
            ],
          ]
        : [];
    }),
  );
  return { primaryTaxonomyId, secondaryTaxonomyIds, tags };
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function documentTypeConfig(type) {
  const normalized = String(type || "").trim();
  const config = DOCUMENT_TYPES[normalized];
  if (!config) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_TYPE",
      `Tipo de documento não suportado: ${type}`,
    );
  }
  return { ...config, type: normalized };
}

export function documentReplicationPayload(document = {}) {
  return {
    documentType: document.documentType,
    title: document.title,
    summary: document.summary,
    markdown: document.markdown,
  };
}

function normalizeStoredDocument(document) {
  if (!document) return null;
  return { ...document, _id: document._id?.toString?.() ?? document._id };
}

function normalizeDate(value, field, { required = false } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized && !required) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DATE",
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
      "INVALID_DOCUMENT_DATE",
      `${field} contém uma data inválida`,
    );
  }
  return normalized;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortText(value, field, maximum = 120) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      `${field} deve ter até ${maximum} caracteres`,
    );
  }
  return normalized;
}

function enumValue(value, field, values, fallback = "") {
  const normalized = String(value || fallback).trim();
  if (!values.includes(normalized)) {
    throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field} é inválido`);
  }
  return normalized;
}

function normalizeDetails(type, value = {}, current = {}) {
  if (
    value !== undefined &&
    (!value || typeof value !== "object" || Array.isArray(value))
  ) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "details deve ser um objeto",
    );
  }
  const details = value || {};
  const previous =
    current && typeof current === "object" && !Array.isArray(current)
      ? current
      : {};
  if (type === "business-rule") {
    return {
      ruleCode: shortText(
        details.ruleCode ?? previous.ruleCode,
        "details.ruleCode",
        80,
      ),
      effectiveFrom: normalizeDate(
        details.effectiveFrom ?? previous.effectiveFrom,
        "details.effectiveFrom",
      ),
    };
  }
  if (type === "architecture-decision") {
    return {
      decidedAt: normalizeDate(
        details.decidedAt ?? previous.decidedAt,
        "details.decidedAt",
      ),
    };
  }
  if (type === "guideline") {
    return {
      scope: enumValue(
        details.scope ?? previous.scope,
        "details.scope",
        ["workspace", "application", "component"],
        "application",
      ),
      enforcement: enumValue(
        details.enforcement ?? previous.enforcement,
        "details.enforcement",
        ["required", "recommended", "informative"],
        "recommended",
      ),
    };
  }
  if (type === "feature") {
    return {
      maturity: enumValue(
        details.maturity ?? previous.maturity,
        "details.maturity",
        ["planned", "beta", "stable", "retired"],
        "stable",
      ),
    };
  }
  if (type === "procedure") return {};
  return {
    referenceKind: enumValue(
      details.referenceKind ?? previous.referenceKind,
      "details.referenceKind",
      ["architecture", "contract", "schema", "protocol", "mechanism"],
      "architecture",
    ),
  };
}

function validateDetailsContext(document, context) {
  if (document.documentType !== "guideline") return;
  const scope = document.details.scope;
  if (scope === "workspace" && context.applicationId) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "Guidelines de workspace não podem estar associadas a uma aplicação",
    );
  }
  if (scope !== "workspace" && !context.applicationId) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "Guidelines de aplicação ou componente exigem applicationId",
    );
  }
  if (scope === "component" && !context.affectedComponentIds.length) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      "Guidelines de componente exigem ao menos um componente afetado",
    );
  }
}

function normalizeSource(value = {}, current = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const previous =
    current && typeof current === "object" && !Array.isArray(current)
      ? current
      : {};
  const mode = enumValue(
    source.mode ?? previous.mode,
    "source.mode",
    ["native", "repository"],
    "native",
  );
  const repositoryId = shortText(
    source.repositoryId ?? previous.repositoryId,
    "source.repositoryId",
    160,
  );
  const path = shortText(source.path ?? previous.path, "source.path", 500);
  if (mode === "repository" && (!repositoryId || !path)) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_SOURCE",
      "source.repositoryId e source.path são obrigatórios para conteúdo de repositório",
    );
  }
  return {
    mode,
    repositoryId: mode === "repository" ? repositoryId : "",
    path: mode === "repository" ? path : "",
  };
}

function normalizeReferences(value, current = []) {
  if (value === undefined) return current || [];
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_REFERENCES",
      `references deve ser um array com no máximo ${MAX_REFERENCES} itens`,
    );
  }
  const seen = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw httpError(
        422,
        "INVALID_DOCUMENT_REFERENCES",
        `references[${index}] é inválida`,
      );
    }
    const targetDocumentId = String(entry.targetDocumentId || "").trim();
    const relationship = String(entry.relationship || "related").trim();
    if (
      !targetDocumentId ||
      !relationship ||
      relationship.length > MAX_RELATIONSHIP
    ) {
      throw httpError(
        422,
        "INVALID_DOCUMENT_REFERENCES",
        `references[${index}] requer targetDocumentId e relationship válidos`,
      );
    }
    const key = `${targetDocumentId}:${relationship}`;
    if (seen.has(key)) {
      throw httpError(
        422,
        "DUPLICATE_DOCUMENT_REFERENCE",
        `Referência duplicada: ${key}`,
      );
    }
    seen.add(key);
    return { targetDocumentId, relationship };
  });
}

function summaryFrom(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/[#>*_`\[\]()~-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 280);
}

export function normalizeDocumentPayload(payload = {}, current = null) {
  const documentType = String(
    payload.documentType ?? current?.documentType ?? "",
  ).trim();
  const config = documentTypeConfig(documentType);
  if (current && documentType !== current.documentType) {
    throw httpError(
      422,
      "DOCUMENT_TYPE_IMMUTABLE",
      "documentType não pode ser alterado após a criação",
    );
  }
  const title = String(payload.title ?? current?.title ?? "").trim();
  const markdown = String(payload.markdown ?? current?.markdown ?? "").trim();
  const summary = String(
    payload.summary ?? current?.summary ?? summaryFrom(markdown),
  ).trim();
  const status = String(
    payload.status ?? current?.status ?? config.defaultStatus,
  ).trim();
  if (!title || title.length > MAX_TITLE) {
    throw httpError(
      422,
      "INVALID_DOCUMENT",
      `title é obrigatório e deve ter até ${MAX_TITLE} caracteres`,
    );
  }
  if (!summary || summary.length > MAX_SUMMARY) {
    throw httpError(
      422,
      "INVALID_DOCUMENT",
      `summary é obrigatório e deve ter até ${MAX_SUMMARY} caracteres`,
    );
  }
  if (!markdown)
    throw httpError(422, "INVALID_DOCUMENT", "markdown é obrigatório");
  if (!config.statuses.includes(status)) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_STATUS",
      `status inválido para ${documentType}: ${status}`,
    );
  }
  const lastReviewedAt = normalizeDate(
    payload.lastReviewedAt ?? current?.lastReviewedAt,
    "lastReviewedAt",
  );
  const reviewChanged =
    lastReviewedAt && lastReviewedAt !== String(current?.lastReviewedAt || "");
  return {
    documentType,
    schemaVersion: 1,
    title,
    summary,
    markdown,
    status,
    details: normalizeDetails(documentType, payload.details, current?.details),
    classification: normalizeClassification(
      payload.classification,
      current?.classification,
    ),
    source: normalizeSource(payload.source, current?.source),
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

async function ensureIndexes(db) {
  const documents = db.collection(COLLECTION_NAMES.DOCUMENTS);
  await Promise.all([
    documents.createIndex({ id: 1 }, { unique: true }),
    documents.createIndex({
      workspaceId: 1,
      documentType: 1,
      status: 1,
      updatedAt: -1,
    }),
    documents.createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
    documents.createIndex({ workspaceId: 1, collectionId: 1, title: 1 }),
    documents.createIndex({
      workspaceId: 1,
      "classification.primaryTaxonomyId": 1,
    }),
    documents.createIndex({
      workspaceId: 1,
      "classification.secondaryTaxonomyIds": 1,
    }),
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
  authorizationScope,
  ownId = "",
) {
  for (const reference of references) {
    if (reference.targetDocumentId === ownId) {
      throw httpError(
        422,
        "SELF_DOCUMENT_REFERENCE",
        "Um documento não pode referenciar a si mesmo",
      );
    }
    const target = await db.collection(COLLECTION_NAMES.DOCUMENTS).findOne({
      id: reference.targetDocumentId,
      workspaceId,
      ...(authorizationScope?.workspace === true
        ? {}
        : { applicationId: { $in: authorizationScope?.applicationIds || [] } }),
    });
    if (!target) {
      throw httpError(
        422,
        "DOCUMENT_REFERENCE_NOT_FOUND",
        `Documento referenciado não encontrado: ${reference.targetDocumentId}`,
      );
    }
  }
}

function revisionSnapshot(document) {
  const { _id, ...snapshot } = document;
  return snapshot;
}

async function appendRevision(db, document, actor, summary) {
  const revisions = db.collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS);
  const previous = await revisions.findOne(
    { entityType: "document", entityId: document.id },
    { sort: { revision: -1 } },
  );
  const revision = (previous?.revision || 0) + 1;
  await revisions.insertOne({
    id: randomUUID(),
    workspaceId: document.workspaceId,
    applicationId: document.applicationId,
    entityType: "document",
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
      { summary: { $regex: escaped, $options: "i" } },
      { markdown: { $regex: escaped, $options: "i" } },
    ],
  };
}

function combinedFilter(query = {}) {
  const contextFilter = buildKnowledgeContextFilter(query);
  if (
    String(query.includeWorkspace || "") === "true" &&
    query.authorizationScope?.workspace === true &&
    String(query.applicationId || "").trim()
  ) {
    contextFilter.applicationId = {
      $in: [String(query.applicationId).trim(), null],
    };
  }
  const conditions = [contextFilter];
  const search = String(query.search || "").trim();
  const documentType = String(query.documentType || "").trim();
  const status = String(query.status || "").trim();
  const collectionId = String(query.collectionId || "").trim();
  if (search) conditions.push(textFilter(search));
  if (documentType) {
    documentTypeConfig(documentType);
    conditions.push({ documentType });
  }
  if (String(query.currentOnly || "") === "true") {
    conditions.push({
      $or: Object.entries(DOCUMENT_TYPES).flatMap(([type, config]) =>
        config.currentStatuses.map((currentStatus) => ({
          documentType: type,
          status: currentStatus,
        })),
      ),
    });
  }
  if (status) conditions.push({ status });
  else if (String(query.includeArchived || "") !== "true")
    conditions.push({ status: { $ne: "archived" } });
  if (collectionId) conditions.push({ collectionId });
  const effective = conditions.filter(
    (entry) => entry && Object.keys(entry).length,
  );
  return effective.length > 1 ? { $and: effective } : effective[0] || {};
}

export async function listDocuments(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const pagination = getPagination(query);
  const filter = combinedFilter(query);
  const collection = db.collection(COLLECTION_NAMES.DOCUMENTS);
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .project({ markdown: 0 })
      .sort({ documentType: 1, title: 1, id: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      database: db.databaseName,
      collection: COLLECTION_NAMES.DOCUMENTS,
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
    items: items.map(normalizeStoredDocument),
  };
}

export async function getDocument(id, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const document = await db.collection(COLLECTION_NAMES.DOCUMENTS).findOne({
    id: String(id),
    ...buildKnowledgeContextFilter(query),
  });
  return {
    meta: { database: db.databaseName, collection: COLLECTION_NAMES.DOCUMENTS },
    document: normalizeStoredDocument(document),
  };
}

export async function createDocument(payload = {}, query = {}) {
  const normalized = normalizeDocumentPayload(payload);
  const config = documentTypeConfig(normalized.documentType);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const context = await resolveKnowledgeContext(db, payload, null, {
    applicationRequired:
      query.allowWorkspaceContext === true ? false : config.applicationRequired,
    authorizationScope: query.authorizationScope,
    create: true,
  });
  validateDetailsContext(normalized, context);
  await assertTaxonomyIdsApplicable(
    db,
    [
      normalized.classification.primaryTaxonomyId,
      ...normalized.classification.secondaryTaxonomyIds,
    ],
    context.workspaceId,
    context.applicationId,
  );
  normalized.collectionId = await assertResourceCollection(
    "documents",
    normalized.collectionId,
    context.workspaceId,
    query,
  );
  await validateReferences(
    db,
    normalized.references,
    context.workspaceId,
    query.authorizationScope,
  );
  const now = new Date();
  const document = {
    id: randomUUID(),
    ...context,
    ...normalized,
    attachments: [],
    createdAt: now,
    createdBy: String(payload.createdBy || "biaws-api"),
    updatedAt: now,
    updatedBy: String(payload.createdBy || "biaws-api"),
  };
  await db.collection(COLLECTION_NAMES.DOCUMENTS).insertOne(document);
  await appendRevision(db, document, document.createdBy, "Documento criado");
  return getDocument(document.id, query);
}

export async function updateDocument(id, payload = {}, query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = { id: String(id), ...buildKnowledgeContextFilter(query) };
  const current = await db
    .collection(COLLECTION_NAMES.DOCUMENTS)
    .findOne(filter);
  if (!current)
    throw httpError(404, "DOCUMENT_NOT_FOUND", "Documento não encontrado");
  const normalized = normalizeDocumentPayload(payload, current);
  const config = documentTypeConfig(normalized.documentType);
  const context = knowledgeContextWasProvided(payload)
    ? await resolveKnowledgeContext(db, payload, current, {
        applicationRequired: config.applicationRequired,
        authorizationScope: query.authorizationScope,
      })
    : {
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        affectedComponentIds: current.affectedComponentIds || [],
      };
  validateDetailsContext(normalized, context);
  await assertTaxonomyIdsApplicable(
    db,
    [
      normalized.classification.primaryTaxonomyId,
      ...normalized.classification.secondaryTaxonomyIds,
    ],
    context.workspaceId,
    context.applicationId,
  );
  normalized.collectionId = await assertResourceCollection(
    "documents",
    normalized.collectionId,
    context.workspaceId,
    query,
  );
  await validateReferences(
    db,
    normalized.references,
    context.workspaceId,
    query.authorizationScope,
    String(id),
  );
  const updatedAt = new Date();
  const updatedBy = String(payload.updatedBy || "biaws-api");
  await db.collection(COLLECTION_NAMES.DOCUMENTS).updateOne(filter, {
    $set: { ...context, ...normalized, updatedAt, updatedBy },
  });
  const document = await db.collection(COLLECTION_NAMES.DOCUMENTS).findOne({
    id: String(id),
    workspaceId: current.workspaceId,
  });
  await appendRevision(
    db,
    document,
    updatedBy,
    payload.changeSummary || "Documento atualizado",
  );
  return {
    meta: { database: db.databaseName, collection: COLLECTION_NAMES.DOCUMENTS },
    document: normalizeStoredDocument(document),
  };
}

export async function archiveDocument(id, payload = {}, query = {}) {
  return updateDocument(
    id,
    {
      ...payload,
      status: "archived",
      changeSummary: payload.changeSummary || "Documento arquivado",
    },
    query,
  );
}

export async function moveDocument(id, collectionId, payload = {}, query = {}) {
  return updateDocument(
    id,
    {
      collectionId,
      updatedBy: payload.updatedBy,
      changeSummary: "Documento movido entre coleções",
    },
    query,
  );
}

async function requireDocument(id, query) {
  const current = await getDocument(id, query);
  if (!current.document)
    throw httpError(404, "DOCUMENT_NOT_FOUND", "Documento não encontrado");
  return current.document;
}

export async function listDocumentRevisions(id, query = {}) {
  await requireDocument(id, query);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const items = await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS)
    .find({ entityType: "document", entityId: String(id) })
    .sort({ revision: -1 })
    .limit(100)
    .toArray();
  return { items: items.map(normalizeStoredDocument) };
}

export async function listDocumentObservations(id, query = {}) {
  await requireDocument(id, query);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const items = await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS)
    .find({ entityType: "document", entityId: String(id) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return { items: items.map(normalizeStoredDocument) };
}

export async function addDocumentObservation(id, payload = {}, query = {}) {
  const current = await requireDocument(id, query);
  const markdown = String(payload.markdown || "").trim();
  if (!markdown)
    throw httpError(
      422,
      "INVALID_DOCUMENT_OBSERVATION",
      "markdown é obrigatório",
    );
  const observation = {
    id: randomUUID(),
    workspaceId: current.workspaceId,
    applicationId: current.applicationId,
    entityType: "document",
    entityId: current.id,
    markdown,
    createdAt: new Date(),
    createdBy: String(payload.createdBy || "biaws-api"),
  };
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS)
    .insertOne(observation);
  return { observation: normalizeStoredDocument(observation) };
}
