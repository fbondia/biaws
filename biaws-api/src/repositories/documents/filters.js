import { DOCUMENT_TYPES, documentTypeConfig } from "./types.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

function textFilter(search) {
  if (!search) return null;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return {
    $or: [
      { identifier: { $regex: escaped, $options: "i" } },
      { title: { $regex: escaped, $options: "i" } },
      { summary: { $regex: escaped, $options: "i" } },
      { markdown: { $regex: escaped, $options: "i" } },
    ],
  };
}

export function combinedFilter(query = {}) {
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
  const conditions = [
    contextFilter,
    { documentType: { $in: Object.keys(DOCUMENT_TYPES) } },
  ];
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
