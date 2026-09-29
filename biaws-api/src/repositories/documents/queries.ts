import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { getPagination } from "../../helpers/query.js";
import { findByReference } from "../../helpers/referenceLookup.js";
import type { StoredKnowledgeDocument } from "../../types/documents.js";
import type { RepositoryQuery } from "../../types/http.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";
import { combinedFilter } from "./filters.js";
import { ensureIndexes } from "./indexes.js";
import { normalizeStoredDocument } from "./normalization.js";
import { httpError } from "./support.js";
import { DOCUMENT_TYPES } from "./types.js";

export async function listDocuments(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  const pagination = getPagination(query);
  const filter = combinedFilter(query);
  const collection = db.collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS);
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .project<StoredKnowledgeDocument>({ markdown: 0 })
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

export async function getDocument(id: string | string[], query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const document = await findByReference<StoredKnowledgeDocument>(
    db.collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS),
    id,
    {
      filter: {
        documentType: { $in: Object.keys(DOCUMENT_TYPES) },
        ...buildKnowledgeContextFilter(query),
      },
      identifierField: "identifier",
      lowercase: true,
    },
  );
  return {
    meta: { database: db.databaseName, collection: COLLECTION_NAMES.DOCUMENTS },
    document: normalizeStoredDocument(document),
  };
}

export async function getDocumentByIdentifier(identifier: unknown, workspaceId: unknown, query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  return normalizeStoredDocument(
    await db.collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS).findOne({
      identifier: String(identifier),
      workspaceId: String(workspaceId),
      documentType: { $in: Object.keys(DOCUMENT_TYPES) },
    }),
  );
}

export async function requireDocument(id: string | string[], query: RepositoryQuery) {
  const current = await getDocument(id, query);
  if (!current.document) throw httpError(404, "DOCUMENT_NOT_FOUND", "Documento não encontrado");
  return current.document;
}
