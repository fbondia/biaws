import { getCollections } from "../storage.js";
import { normalizeGroup } from "../normalization.js";
import { groupIdCandidates } from "../support.js";

export async function listPermissionGroups({
  includeInactive = true,
  workspaceId,
} = {}) {
  const { groups, defaultWorkspace } = await getCollections();
  const filter = {
    workspaceId: String(workspaceId || defaultWorkspace.id),
    ...(includeInactive ? {} : { active: true }),
  };
  const documents = await groups
    .find(filter)
    .sort({ system: -1, name: 1 })
    .toArray();
  return documents.map(normalizeGroup);
}

export async function getPermissionGroup(groupId, { workspaceId } = {}) {
  const { groups, defaultWorkspace } = await getCollections();
  return normalizeGroup(
    await groups.findOne({
      _id: { $in: groupIdCandidates([groupId]) },
      workspaceId: String(workspaceId || defaultWorkspace.id),
    }),
  );
}
