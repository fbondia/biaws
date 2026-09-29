import { textValue } from "../../helpers/text.js";
import type { RepositoryQuery } from "../../types/http.js";
import { DOCUMENT_TYPES, documentTypeConfig } from "./types.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";
import type { Filter, Document } from "mongodb";

function textFilter(search: string) {
  if (!search) return null;
  const escaped = search.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return {
    $or: [
      { identifier: { $regex: escaped, $options: "i" } },
      { title: { $regex: escaped, $options: "i" } },
      { summary: { $regex: escaped, $options: "i" } },
      { markdown: { $regex: escaped, $options: "i" } },
    ],
  };
}

export function combinedFilter(query: RepositoryQuery = {}) {
  const contextFilter = buildKnowledgeContextFilter(query);
  if (
    textValue(query.includeWorkspace || "") === "true" &&
    query.authorizationScope?.workspace === true &&
    String(query.applicationId || "").trim()
  ) {
    contextFilter.applicationId = {
      $in: [String(query.applicationId).trim(), null],
    };
  }
  const conditions: Filter<Document>[] = [contextFilter, { documentType: { $in: Object.keys(DOCUMENT_TYPES) } }];
  const search = textValue(query.search || "").trim();
  const documentType = textValue(query.documentType || "").trim();
  const status = textValue(query.status || "").trim();
  const collectionId = textValue(query.collectionId || "").trim();
  if (search) conditions.push(textFilter(search)!);
  if (documentType) {
    documentTypeConfig(documentType);
    conditions.push({ documentType });
  }
  if (textValue(query.currentOnly || "") === "true") {
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
  else if (textValue(query.includeArchived || "") !== "true") conditions.push({ status: { $ne: "archived" } });
  if (collectionId) conditions.push({ collectionId });
  const effective = conditions.filter((entry) => entry && Object.keys(entry).length);
  return effective.length > 1 ? { $and: effective } : effective[0] || {};
}
