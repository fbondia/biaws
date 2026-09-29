import type { StoredKnowledgeDocument } from "../../types/documents.js";
import type { Db, WithId } from "mongodb";
import type { Actor } from "../../types/http.js";
import type { RepositoryQuery } from "../../types/http.js";
import { requireDocument } from "./queries.js";
import { normalizeStoredDocument } from "./normalization.js";
import { randomUUID } from "node:crypto";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

function revisionSnapshot(document: StoredKnowledgeDocument) {
  const { _id, ...snapshot } = document;
  return snapshot;
}

export async function appendRevision(
  db: Db,
  document: StoredKnowledgeDocument,
  actor: unknown,
  summary: string,
) {
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

export async function listDocumentRevisions(
  id: string | string[],
  query: RepositoryQuery = {},
) {
  id = (await requireDocument(id, query)).id;
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const items = await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS)
    .find({ entityType: "document", entityId: String(id) })
    .sort({ revision: -1 })
    .limit(100)
    .toArray();
  return { items: items.map(normalizeStoredDocument) };
}
