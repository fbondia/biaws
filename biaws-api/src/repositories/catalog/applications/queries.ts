import type { ApplicationDocument } from "../../../types/catalog.js";
import type { Filter, WithId } from "mongodb";
import type { RepositoryQuery } from "../../../types/http.js";
import { requireWorkspace } from "../workspaces/queries.js";
import { getCollections } from "../storage.js";
import { buildApplicationFilter } from "./filters.js";
import { APPLICATIONS_COLLECTION } from "../constants.js";
import { normalizeDocument } from "../support.js";
import { CATALOG_LIMITS } from "../../../../../shared/index.js";

function publicApplication(
  document: WithId<ApplicationDocument>,
): ApplicationDocument {
  return normalizeDocument(document) as ApplicationDocument;
}

export async function listApplications(
  workspaceId: string | string[],
  query: RepositoryQuery = {},
) {
  await requireWorkspace(workspaceId);
  const { applications } = await getCollections();
  const filter = buildApplicationFilter(
    String(workspaceId),
    query,
  ) as Filter<ApplicationDocument> & Record<string, unknown>;
  const authorizedApplicationIds =
    query.authorizationScope?.workspace === true
      ? null
      : query.authorizationScope?.applicationIds;
  if (Array.isArray(authorizedApplicationIds)) {
    filter.id = { $in: authorizedApplicationIds.map(String) };
  }
  const limit = Math.min(
    CATALOG_LIMITS.pageSize,
    Math.max(1, Number(query.limit) || 50),
  );
  const page = Math.max(1, Number(query.page) || 1);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    applications
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    applications.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: APPLICATIONS_COLLECTION,
      workspaceId: String(workspaceId),
      total,
      page,
      limit,
    },
    items: items.map(publicApplication),
  };
}

export async function getApplication(
  applicationId: string | string[],
  { workspaceId }: { workspaceId?: string | null } = {},
) {
  const { applications } = await getCollections();
  const filter: Record<string, string> = { id: String(applicationId) };
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const document = await applications.findOne(filter);
  return document ? publicApplication(document) : null;
}

export async function getApplicationByKey(
  key: string,
  { workspaceId }: { workspaceId?: string | null } = {},
) {
  if (!workspaceId) return null;
  const { applications } = await getCollections();
  const document = await applications.findOne({
    key: String(key),
    workspaceId: String(workspaceId),
  });
  return document ? publicApplication(document) : null;
}
