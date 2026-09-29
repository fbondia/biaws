import type { Actor } from "../../../types/http.js";
import { createHttpError, identityIdCandidates, groupIdCandidates } from "../support.js";
import { getCollections } from "../storage.js";
import { getUserAccess } from "./queries.js";

export async function setUserGroups(
  userId: string,
  groupIds: string[],
  actor: Partial<Actor>,
  { workspaceId }: { workspaceId?: string } = {},
) {
  if (!Array.isArray(groupIds)) {
    throw createHttpError(422, "INVALID_USER_GROUPS", "groupIds must be an array");
  }
  const normalizedGroupIds = [...new Set(groupIds.map(String))];
  const { groups, userAccess, users, defaultWorkspace } = await getCollections();
  const effectiveWorkspaceId = String(workspaceId || actor?.workspaceId || defaultWorkspace.id);
  const userExists = await users.countDocuments({ _id: { $in: identityIdCandidates(userId) } }, { limit: 1 });
  if (!userExists) {
    throw createHttpError(404, "USER_NOT_FOUND", `User not found: ${userId}`);
  }
  const validGroups = await groups
    .find({
      _id: { $in: groupIdCandidates(normalizedGroupIds) },
      workspaceId: effectiveWorkspaceId,
      active: true,
    })
    .project({ _id: 1 })
    .toArray();
  if (validGroups.length !== normalizedGroupIds.length) {
    throw createHttpError(422, "INVALID_USER_GROUPS", "All associated groups must exist and be active");
  }

  const currentAccess = await userAccess.findOne({
    userId: String(userId),
    workspaceId: effectiveWorkspaceId,
  });
  const administrationGroup = await groups.findOne({
    workspaceId: effectiveWorkspaceId,
    system: true,
    $or: [{ systemKey: "administration" }, { _id: "administration" }],
    active: true,
  });
  const administrationGroupId = administrationGroup ? String(administrationGroup._id) : "";
  if (
    administrationGroupId &&
    currentAccess?.groupIds?.includes(administrationGroupId) &&
    !normalizedGroupIds.includes(administrationGroupId)
  ) {
    const administratorCount = await userAccess.countDocuments({
      workspaceId: effectiveWorkspaceId,
      groupIds: administrationGroupId,
    });
    if (administratorCount <= 1) {
      throw createHttpError(409, "LAST_WORKSPACE_ADMIN", "The last workspace administrator cannot be removed");
    }
  }

  const now = new Date();
  await userAccess.updateOne(
    { userId, workspaceId: effectiveWorkspaceId },
    {
      $set: {
        workspaceId: effectiveWorkspaceId,
        groupIds: normalizedGroupIds,
        updatedAt: now,
        updatedBy: actor.userId,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  return getUserAccess(userId, { workspaceId: effectiveWorkspaceId });
}

export async function removeUserAccess(userId: string, workspaceId?: string) {
  const { groups, userAccess, defaultWorkspace } = await getCollections();
  const effectiveWorkspaceId = String(workspaceId || defaultWorkspace.id);
  const access = await userAccess.findOne({
    userId: String(userId),
    workspaceId: effectiveWorkspaceId,
  });
  if (!access) return false;

  const administrationGroup = await groups.findOne({
    workspaceId: effectiveWorkspaceId,
    system: true,
    $or: [{ systemKey: "administration" }, { _id: "administration" }],
    active: true,
  });
  if (administrationGroup && access.groupIds?.includes(String(administrationGroup._id))) {
    const administratorCount = await userAccess.countDocuments({
      workspaceId: effectiveWorkspaceId,
      groupIds: String(administrationGroup._id),
    });
    if (administratorCount <= 1) {
      throw createHttpError(409, "LAST_WORKSPACE_ADMIN", "The last workspace administrator cannot be removed");
    }
  }
  const result = await userAccess.deleteOne({
    userId: String(userId),
    workspaceId: effectiveWorkspaceId,
  });
  return result.deletedCount === 1;
}
