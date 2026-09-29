import { requireWorkspace } from "../workspaces/queries.js";
import { getCollections } from "../storage.js";
import { buildApplicationFilter } from "./filters.js";
import { APPLICATIONS_COLLECTION } from "../constants.js";
import { normalizeDocument } from "../support.js";
import { CATALOG_LIMITS } from "../../../../../shared/index.js";

export async function listApplications(workspaceId, query = {}) {
  await requireWorkspace(workspaceId);
  const { applications } = await getCollections();
  const filter = buildApplicationFilter(workspaceId, query);
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
    items: items.map(normalizeDocument),
  };
}

export async function getApplication(applicationId, { workspaceId } = {}) {
  const { applications } = await getCollections();
  const filter = { id: String(applicationId) };
  if (workspaceId) filter.workspaceId = String(workspaceId);
  return normalizeDocument(await applications.findOne(filter));
}

export async function getApplicationByKey(key, { workspaceId } = {}) {
  if (!workspaceId) return null;
  const { applications } = await getCollections();
  return normalizeDocument(
    await applications.findOne({
      key: String(key),
      workspaceId: String(workspaceId),
    }),
  );
}
