import { createHttpError } from "../support.js";
import { APPLICATION_STATUSES } from "../../../../../shared/index.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildApplicationFilter(workspaceId, query = {}) {
  const filter = { workspaceId: String(workspaceId) };
  if (query.collectionId !== undefined) {
    const collectionId = String(query.collectionId || "").trim();
    filter.collectionId = collectionId || { $in: ["", null] };
  }
  if (query.status) {
    if (!APPLICATION_STATUSES.includes(query.status)) {
      throw createHttpError(
        422,
        "INVALID_APPLICATION_STATUS",
        `status must be one of: ${APPLICATION_STATUSES.join(", ")}`,
      );
    }
    filter.status = query.status;
  } else if (String(query.includeArchived || "").toLowerCase() !== "true") {
    filter.status = "active";
  }
  const search = String(query.q || "").trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "iu");
    filter.$or = [
      { key: pattern },
      { name: pattern },
      { description: pattern },
    ];
  }
  return filter;
}
