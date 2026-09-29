import type { RepositoryQuery } from "../../../types/http.js";
import { createHttpError } from "../support.js";
import { APPLICATION_STATUSES } from "../../../../../shared/index.js";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildApplicationFilter(
  workspaceId: string,
  query: RepositoryQuery = {},
) {
  const filter: {
    workspaceId: string;
    collectionId?: string | { $in: (string | null)[] };
    status?: string;
    $or?: Array<{ key?: RegExp; name?: RegExp; description?: RegExp }>;
  } = { workspaceId: String(workspaceId) };
  if (query.collectionId !== undefined) {
    const collectionId = String(query.collectionId || "").trim();
    filter.collectionId = collectionId || { $in: ["", null] };
  }
  if (query.status) {
    if (!APPLICATION_STATUSES.includes(String(query.status))) {
      throw createHttpError(
        422,
        "INVALID_APPLICATION_STATUS",
        `status must be one of: ${APPLICATION_STATUSES.join(", ")}`,
      );
    }
    filter.status = String(query.status);
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
