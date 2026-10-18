import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { textValue } from "../../helpers/text.js";
import type { StoredKnowledgeDocument } from "../../types/documents.js";
import type { RepositoryQuery } from "../../types/http.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";
import { documentConversionPayload, incorporatedDocumentItem } from "./conversionContent.js";
import { normalizeCatalogItems } from "./catalogItems.js";
import { updateDocument } from "./mutations.js";
import { normalizeStoredDocument } from "./normalization.js";
import { requireDocument } from "./queries.js";
import { appendRevision } from "./revisions.js";
import { httpError } from "./support.js";

export async function convertDocument(
  id: string | string[],
  options: Record<string, unknown>,
  query: RepositoryQuery = {},
) {
  const source = await requireDocument(id, query);
  if (source.status === "archived")
    throw httpError(422, "INVALID_DOCUMENT_CONVERSION", "Desarquive o documento antes de converter");
  if (
    options.expectedUpdatedAt &&
    new Date(String(options.expectedUpdatedAt)).getTime() !== new Date(source.updatedAt!).getTime()
  ) {
    throw httpError(409, "DOCUMENT_CHANGED", "O documento foi alterado. Recarregue antes de converter.");
  }
  const updatedBy = textValue(options.updatedBy || "biaws-api");
  if ((options.mode || "convert") === "convert") {
    const result = await updateDocument(
      source.id,
      {
        ...documentConversionPayload(source, options),
        updatedBy,
      },
      query,
      { allowTypeChange: true, expectedUpdatedAt: source.updatedAt },
    );
    return { ...result, previousDocument: source, sourceDocumentId: source.id };
  }
  if (options.mode !== "catalog-item" || options.targetType !== "catalog" || !options.targetCatalogId) {
    throw httpError(422, "INVALID_DOCUMENT_CONVERSION", "Informe o catálogo de destino");
  }
  const target = await requireDocument(String(options.targetCatalogId), query);
  if (
    target.id === source.id ||
    target.workspaceId !== source.workspaceId ||
    target.documentType !== "catalog" ||
    target.status === "archived"
  ) {
    throw httpError(422, "INVALID_CATALOG_TARGET", "Escolha outro catálogo ativo do mesmo workspace");
  }
  const item = incorporatedDocumentItem(source, options.additionalData);
  const items = normalizeCatalogItems(target.details.items);
  if (items.some(({ id }) => id === item.id))
    throw httpError(409, "DOCUMENT_ALREADY_IN_CATALOG", "Este documento já foi incorporado ao catálogo");
  const nextItems = normalizeCatalogItems([...items, item]);
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const document = await db.collection<StoredKnowledgeDocument>(COLLECTION_NAMES.DOCUMENTS).findOneAndUpdate(
    {
      ...buildKnowledgeContextFilter(query),
      id: target.id,
      documentType: "catalog",
      updatedAt: target.updatedAt,
    },
    {
      $set: {
        details: { ...target.details, items: nextItems },
        updatedAt: new Date(Math.max(Date.now(), new Date(target.updatedAt || 0).getTime() + 1)),
        updatedBy,
      },
    },
    { returnDocument: "after" },
  );
  if (!document) throw httpError(409, "DOCUMENT_CHANGED", "O catálogo foi alterado. Recarregue e tente novamente.");
  await appendRevision(db, document, updatedBy, `Documento incorporado como elemento: ${source.title} (${source.id})`);
  return { document: normalizeStoredDocument(document), previousDocument: target, sourceDocumentId: source.id };
}
