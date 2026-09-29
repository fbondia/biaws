import type { Actor } from "../../types/http.js";
import { getCollections } from "./storage.js";
import { createHttpError, groupIdCandidates } from "./support.js";
import { normalizeGroup, calculateEffectivePermissions, calculatePermissionScopes } from "./normalization.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export async function resolveUserAuthorization(userId: string, requestedWorkspaceId = "") {
  const { db, groups, userAccess } = await getCollections();
  const bindings = await userAccess.find({ userId }).toArray();
  const workspaceIds = [...new Set(bindings.map(({ workspaceId }) => String(workspaceId)))];
  const workspaceRows = workspaceIds.length
    ? await db
        .collection<NonNullable<Actor["workspaces"]>[number]>(COLLECTION_NAMES.WORKSPACES)
        .find({ id: { $in: workspaceIds }, status: "active" })
        .project({ _id: 0, id: 1, key: 1, name: 1 })
        .sort({ name: 1 })
        .toArray()
    : [];
  const workspaces = workspaceRows.map((workspace) => ({
    id: String(workspace.id),
    key: String(workspace.key || ""),
    name: String(workspace.name || ""),
  }));
  const selectedWorkspaceId =
    String(requestedWorkspaceId || "").trim() || (workspaces.length === 1 ? workspaces[0].id : "");
  if (requestedWorkspaceId && !workspaces.some(({ id }) => id === selectedWorkspaceId)) {
    throw createHttpError(403, "WORKSPACE_FORBIDDEN", "The authenticated actor cannot access the requested workspace");
  }
  const access = bindings.find(({ workspaceId }) => String(workspaceId) === selectedWorkspaceId);
  const groupIds = access?.groupIds || [];
  const groupDocuments = selectedWorkspaceId
    ? await groups
        .find({
          _id: { $in: groupIdCandidates(groupIds) },
          workspaceId: selectedWorkspaceId,
          active: true,
        })
        .sort({ name: 1 })
        .toArray()
    : [];
  const normalizedGroups = groupDocuments.map((document) => normalizeGroup(document));
  return {
    workspaceId: selectedWorkspaceId || null,
    workspaces,
    groups: normalizedGroups.map(({ id, name }) => ({ id, name: name || "" })),
    permissions: calculateEffectivePermissions(normalizedGroups),
    permissionScopes: calculatePermissionScopes(normalizedGroups),
  };
}
