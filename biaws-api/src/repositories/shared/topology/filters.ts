import type { Filter, Document } from "mongodb";
import type { RepositoryQuery } from "../../../types/http.js";
import { createCatalogError } from "./errors.js";
import { normalizeEnum } from "./normalization.js";
import { CATALOG_LIMITS } from "../../../../../shared/index.js";

export function pagination(query: RepositoryQuery = {}) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 50);
  if (!Number.isInteger(page) || page < 1) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAGINATION",
      "page must be a positive integer",
    );
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAGINATION",
      "limit must be a positive integer",
    );
  }
  const safeLimit = Math.min(limit, CATALOG_LIMITS.pageSize);
  return { page, limit: safeLimit, skip: (page - 1) * safeLimit };
}

export function escapeRegex(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildScopedListFilter({
  workspaceId,
  applicationId,
  statuses,
  query = {},
  searchFields = ["key", "name", "description"],
}: {
  workspaceId: unknown;
  applicationId?: unknown;
  statuses: readonly string[];
  query?: RepositoryQuery;
  searchFields?: string[];
}) {
  const filter: Filter<Document> = { workspaceId: String(workspaceId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (query.status) {
    filter.status = normalizeEnum(query.status, "status", statuses);
  } else if (String(query.includeArchived || "").toLowerCase() !== "true") {
    filter.status =
      statuses.length === 2 && statuses.includes("active")
        ? "active"
        : { $ne: "archived" };
  }
  const search = String(query.q || "").trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "iu");
    filter.$or = searchFields.map((field: string) => ({ [field]: pattern }));
  }
  return filter;
}
