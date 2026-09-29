import type { Db } from "mongodb";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export async function ensureIndexes(db: Db) {
  const documents = db.collection(COLLECTION_NAMES.DOCUMENTS);
  await Promise.all([
    documents.createIndex({ id: 1 }, { unique: true }),
    documents.createIndex(
      { workspaceId: 1, identifier: 1 },
      {
        unique: true,
        name: "workspace_document_identifier_unique",
        partialFilterExpression: { identifier: { $type: "string" } },
      },
    ),
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
      .createIndex({ entityType: 1, entityId: 1, revision: -1 }, { unique: true }),
    db.collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS).createIndex({ entityType: 1, entityId: 1, createdAt: -1 }),
  ]);
}
