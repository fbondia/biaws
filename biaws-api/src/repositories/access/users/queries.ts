import { getCollections } from "../storage.js";

export async function getUserAccess(userId: string | string[], { workspaceId }: { workspaceId?: string } = {}) {
  const { userAccess, defaultWorkspace } = await getCollections();
  const effectiveWorkspaceId = String(workspaceId || defaultWorkspace.id);
  const document = await userAccess.findOne({
    userId: String(userId),
    workspaceId: effectiveWorkspaceId,
  });
  return {
    userId: String(userId),
    workspaceId: effectiveWorkspaceId,
    groupIds: document?.groupIds || [],
  };
}

export async function getUsersAccess(userIds: string[], { workspaceId }: { workspaceId?: string } = {}) {
  const normalizedUserIds = [
    ...new Set((Array.isArray(userIds) ? userIds : []).map((userId) => String(userId || "").trim()).filter(Boolean)),
  ];

  if (!normalizedUserIds.length) return [];

  const { userAccess, defaultWorkspace } = await getCollections();
  const effectiveWorkspaceId = String(workspaceId || defaultWorkspace.id);
  const documents = await userAccess
    .find({
      userId: { $in: normalizedUserIds },
      workspaceId: effectiveWorkspaceId,
    })
    .project({ _id: 0, userId: 1, workspaceId: 1, groupIds: 1 })
    .toArray();

  return documents.map((document) => ({
    userId: String(document.userId),
    workspaceId: String(document.workspaceId),
    groupIds: document.groupIds || [],
  }));
}
