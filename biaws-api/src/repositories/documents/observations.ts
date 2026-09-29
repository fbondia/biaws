import type { RepositoryQuery } from "../../types/http.js";
import { requireDocument } from "./queries.js";
import { normalizeStoredDocument } from "./normalization.js";
import { httpError } from "./support.js";
import { randomUUID } from "node:crypto";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

export async function listDocumentObservations(
  id: string | string[],
  query: RepositoryQuery = {},
) {
  id = (await requireDocument(id, query)).id;
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const items = await db
    .collection(COLLECTION_NAMES.KNOWLEDGE_OBSERVATIONS)
    .find({ entityType: "document", entityId: String(id) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return { items: items.map(normalizeStoredDocument) };
}

export async function addDocumentObservation(
  id: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const current = await requireDocument(id, query);
  id = current.id;
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
