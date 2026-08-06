import { ObjectId } from "mongodb";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import {
  ensureWorkspacePermissionGroups,
  listPermissionGroups,
  removeUserAccess,
  setUserGroups,
} from "./accessRepository.js";
import {
  createWorkspace,
  getWorkspace,
  listAllWorkspaces,
  setWorkspaceStatus,
  updateWorkspace,
} from "./catalogRepository.js";

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function identityCandidates(userId) {
  const values = [String(userId)];
  if (ObjectId.isValid(userId)) values.push(new ObjectId(userId));
  return values;
}

export { getWorkspace, listAllWorkspaces, setWorkspaceStatus, updateWorkspace };

export async function provisionWorkspace(payload = {}, actor = {}) {
  const administratorUserId = String(
    payload.administratorUserId || actor.userId || "",
  ).trim();
  if (!administratorUserId) {
    throw createHttpError(
      422,
      "WORKSPACE_ADMIN_REQUIRED",
      "An initial workspace administrator is required",
    );
  }
  const db = await getMongoDatabase();
  const administratorExists = await db
    .collection(COLLECTION_NAMES.AUTH_USERS)
    .countDocuments(
      { _id: { $in: identityCandidates(administratorUserId) } },
      { limit: 1 },
    );
  if (!administratorExists) {
    throw createHttpError(
      404,
      "USER_NOT_FOUND",
      "Initial administrator not found",
    );
  }
  const workspace = await createWorkspace(
    {
      key: payload.key,
      name: payload.name,
      description: payload.description,
    },
    actor,
  );
  const groups = await ensureWorkspacePermissionGroups(workspace.id, actor);
  const administration = groups.find(
    ({ systemKey, name }) =>
      systemKey === "administration" || name === "Administração",
  );
  if (!administration) {
    throw createHttpError(
      500,
      "WORKSPACE_PROVISIONING_FAILED",
      "The administration group could not be provisioned",
    );
  }
  await setUserGroups(administratorUserId, [administration.id], actor, {
    workspaceId: workspace.id,
  });
  return { workspace, administrationGroupId: administration.id };
}

export async function getWorkspaceSummary(workspaceId) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const db = await getMongoDatabase();
  const filter = { workspaceId: workspace.id };
  const [members, groups, applications, servers, issues, demands] =
    await Promise.all([
      db
        .collection(COLLECTION_NAMES.WORKSPACE_MEMBERSHIPS)
        .countDocuments(filter),
      db.collection(COLLECTION_NAMES.PERMISSION_GROUPS).countDocuments(filter),
      db.collection(COLLECTION_NAMES.APPLICATIONS).countDocuments(filter),
      db.collection(COLLECTION_NAMES.SERVERS).countDocuments(filter),
      db.collection(COLLECTION_NAMES.ISSUES).countDocuments(filter),
      db.collection(COLLECTION_NAMES.REQUESTS).countDocuments(filter),
    ]);
  return { members, groups, applications, servers, issues, demands };
}

export async function listWorkspaceMembers(workspaceId) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const db = await getMongoDatabase();
  const memberships = await db
    .collection(COLLECTION_NAMES.WORKSPACE_MEMBERSHIPS)
    .find({ workspaceId: workspace.id })
    .sort({ createdAt: 1 })
    .toArray();
  const groups = await listPermissionGroups({ workspaceId: workspace.id });
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const candidates = memberships.flatMap(({ userId }) =>
    identityCandidates(userId),
  );
  const users = candidates.length
    ? await db
        .collection(COLLECTION_NAMES.AUTH_USERS)
        .find({ _id: { $in: candidates } })
        .project({ name: 1, email: 1, banned: 1 })
        .toArray()
    : [];
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  return memberships.map((membership) => {
    const user = usersById.get(String(membership.userId));
    const groupIds = (membership.groupIds || []).map(String);
    return {
      userId: String(membership.userId),
      name: user?.name || "",
      email: user?.email || "",
      disabled: user?.banned === true,
      groupIds,
      groups: groupIds
        .map((groupId) => groupsById.get(groupId)?.name)
        .filter(Boolean),
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    };
  });
}

export async function setWorkspaceMemberGroups(
  workspaceId,
  userId,
  groupIds,
  actor,
) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace || workspace.status !== "active") {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  return setUserGroups(userId, groupIds, actor, { workspaceId: workspace.id });
}

export async function removeWorkspaceMember(workspaceId, userId) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const removed = await removeUserAccess(userId, workspace.id);
  if (!removed) {
    throw createHttpError(404, "MEMBERSHIP_NOT_FOUND", "Membership not found");
  }
  return { removed: true };
}
