import { getCollections } from "../storage.js";
import { ensureDefaultWorkspace } from "./bootstrap.js";
import { WORKSPACES_COLLECTION } from "../constants.js";
import { normalizeDocument, createHttpError } from "../support.js";
import { buildOperationalWorkspaceFilter } from "./filters.js";

export async function listWorkspaces({ workspaceIds = null } = {}) {
  const { workspaces } = await getCollections();
  await ensureDefaultWorkspace();
  const normalizedIds = Array.isArray(workspaceIds)
    ? [...new Set(workspaceIds.map(String).filter(Boolean))]
    : null;
  const items = await workspaces
    .find(normalizedIds ? { id: { $in: normalizedIds } } : { default: true })
    .sort({ name: 1 })
    .toArray();
  return {
    meta: {
      collection: WORKSPACES_COLLECTION,
      total: items.length,
      multiWorkspaceEnabled: true,
    },
    items: items.map(normalizeDocument),
  };
}

export async function listAllWorkspaces(query = {}) {
  const { workspaces } = await getCollections();
  await ensureDefaultWorkspace();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const status = String(query.status || "").trim();
  const q = String(query.q || "").trim();
  const filter = {};
  if (status) {
    if (!["active", "archived"].includes(status)) {
      throw createHttpError(
        422,
        "INVALID_WORKSPACE_STATUS",
        "Invalid workspace status",
      );
    }
    filter.status = status;
  }
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const expression = new RegExp(escaped, "iu");
    filter.$or = [
      { key: expression },
      { name: expression },
      { description: expression },
    ];
  }
  const [items, total] = await Promise.all([
    workspaces
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    workspaces.countDocuments(filter),
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    items: items.map(normalizeDocument),
  };
}

export async function getWorkspace(workspaceId) {
  const { workspaces } = await getCollections();
  await ensureDefaultWorkspace();
  return normalizeDocument(
    await workspaces.findOne(buildOperationalWorkspaceFilter(workspaceId)),
  );
}

export async function requireWorkspace(workspaceId, { active = false } = {}) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (active && workspace.status !== "active") {
    throw createHttpError(409, "WORKSPACE_ARCHIVED", "Workspace is archived");
  }
  return workspace;
}
