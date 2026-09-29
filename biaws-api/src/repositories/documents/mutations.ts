import type { StoredKnowledgeDocument } from "../../types/documents.js";
import type { UpdateFilter } from "mongodb";
import { isRecord } from "../../helpers/records.js";
import type { RepositoryQuery } from "../../types/http.js";
import {
  normalizeDocumentPayload,
  normalizeStoredDocument,
  restoredDocumentStatus,
} from "./normalization.js";
import { documentTypeConfig } from "./types.js";
import { ensureIndexes } from "./indexes.js";
import { validateDetailsContext } from "./context.js";
import { validateReferences } from "./references.js";
import { httpError } from "./support.js";
import { appendRevision } from "./revisions.js";
import { getDocument, requireDocument } from "./queries.js";
import { randomUUID } from "node:crypto";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import {
  buildKnowledgeContextFilter,
  knowledgeContextWasProvided,
  resolveKnowledgeContext,
} from "../shared/knowledgeContext.js";
import { assertResourceCollection } from "../resourceCollections/queries.js";
import { assertTaxonomyIdsApplicable } from "../../helpers/taxonomy.js";

export async function createDocument(
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
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
  try {
    await db
      .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
      .insertOne(document);
  } catch (error) {
    if (
      isRecord(error) &&
      error.code === 11000 &&
      isRecord(error.keyPattern) &&
      error.keyPattern.identifier
    ) {
      throw httpError(
        409,
        "DOCUMENT_IDENTIFIER_CONFLICT",
        "Já existe um documento com este identificador no workspace",
      );
    }
    throw error;
  }
  await appendRevision(db, document, document.createdBy, "Documento criado");
  return getDocument(document.id, query);
}

export async function updateDocument(
  id: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  id = (await requireDocument(id, query)).id;
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const filter = { id: String(id), ...buildKnowledgeContextFilter(query) };
  const current = await db
    .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
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
  try {
    await db
      .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
      .updateOne(filter, {
        $set: { ...context, ...normalized, updatedAt, updatedBy },
      });
  } catch (error) {
    if (
      isRecord(error) &&
      error.code === 11000 &&
      isRecord(error.keyPattern) &&
      error.keyPattern.identifier
    ) {
      throw httpError(
        409,
        "DOCUMENT_IDENTIFIER_CONFLICT",
        "Já existe um documento com este identificador no workspace",
      );
    }
    throw error;
  }
  const document = await db
    .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
    .findOne({
      id: String(id),
      workspaceId: current.workspaceId,
    });
  if (!document) throw new Error("Updated document is unavailable");
  await appendRevision(
    db,
    document,
    updatedBy,
    String(payload.changeSummary || "Documento atualizado"),
  );
  return {
    meta: { database: db.databaseName, collection: COLLECTION_NAMES.DOCUMENTS },
    document: normalizeStoredDocument(document),
  };
}

export async function archiveDocument(
  id: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const current = await requireDocument(id, query);
  id = current.id;
  const result = await updateDocument(
    id,
    {
      ...payload,
      status: "archived",
      changeSummary: payload.changeSummary || "Documento arquivado",
    },
    query,
  );
  if (current.status !== "archived") {
    const db = await getMongoDatabase({
      db: query.db,
      database: query.database,
    });
    await db
      .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
      .updateOne(
        {
          id: String(id),
          workspaceId: current.workspaceId,
          status: "archived",
        },
        { $set: { archivedFromStatus: current.status } },
      );
  }
  return result;
}

export async function restoreDocument(
  id: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const current = await requireDocument(id, query);
  id = current.id;
  if (current.status !== "archived") return getDocument(id, query);
  const restoredStatus = restoredDocumentStatus(current);
  const result = await updateDocument(
    id,
    {
      ...payload,
      status: restoredStatus,
      changeSummary: payload.changeSummary || "Documento desarquivado",
    },
    query,
  );
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await db
    .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
    .updateOne(
      { id: String(id), workspaceId: current.workspaceId },
      { $unset: { archivedFromStatus: "" } },
    );
  if (!result.document) throw new Error("Restored document is unavailable");
  delete result.document.archivedFromStatus;
  return result;
}

export async function deleteDocument(
  id: string | string[],
  query: RepositoryQuery = {},
) {
  id = (await requireDocument(id, query)).id;
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const filter = { id: String(id), ...buildKnowledgeContextFilter(query) };
  const document = await db
    .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
    .findOne(filter);
  if (!document) {
    throw httpError(404, "DOCUMENT_NOT_FOUND", "Documento não encontrado");
  }
  if (document.status !== "archived") {
    throw httpError(
      409,
      "DOCUMENT_NOT_ARCHIVED",
      "Somente documentos arquivados podem ser excluídos definitivamente",
    );
  }

  const result = await db
    .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
    .deleteOne({ ...filter, status: "archived" });
  if (!result.deletedCount) {
    throw httpError(409, "DOCUMENT_DELETE_CONFLICT", "Documento não excluído");
  }

  await Promise.all([
    db.collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS).deleteMany({
      entityType: "document",
      entityId: String(id),
    }),
    db.collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS).deleteMany({
      entityType: "document",
      entityId: String(id),
    }),
    db
      .collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS)
      .updateMany(
        {
          workspaceId: document.workspaceId,
          "references.targetDocumentId": String(id),
        },
        {
          $pull: { references: { targetDocumentId: String(id) } },
        } as unknown as UpdateFilter<StoredKnowledgeDocument>,
      ),
  ]);

  return {
    meta: { database: db.databaseName, collection: COLLECTION_NAMES.DOCUMENTS },
    deleted: true,
    document: normalizeStoredDocument(document),
    id: String(id),
  };
}

export async function moveDocument(
  id: string | string[],
  collectionId: string,
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  id = (await requireDocument(id, query)).id;
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
