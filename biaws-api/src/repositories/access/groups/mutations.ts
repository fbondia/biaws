import type { Actor } from "../../../types/http.js";
import type { WorkspaceDocument } from "../../../types/catalog.js";
import { errorCode } from "../../../helpers/error.js";
import { getCollections } from "../storage.js";
import { createHttpError, groupIdCandidates } from "../support.js";
import { upsertInitialPermissionGroups } from "../seeds.js";
import { listPermissionGroups } from "./queries.js";
import { normalizeGroupInput, normalizeGroup } from "../normalization.js";
import { randomUUID } from "node:crypto";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";

export async function ensureWorkspacePermissionGroups(
  workspaceId: string,
  actor: Partial<Actor> = {},
) {
  const { db, groups } = await getCollections();
  const workspace = await db
    .collection<WorkspaceDocument>(COLLECTION_NAMES.WORKSPACES)
    .findOne({
      id: String(workspaceId),
      status: "active",
    });
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  await upsertInitialPermissionGroups(groups, workspace, actor);
  return listPermissionGroups({ workspaceId: workspace.id });
}

export async function createPermissionGroup(
  payload: Record<string, unknown> = {},
  actor: Actor,
) {
  const { db, groups, defaultWorkspace } = await getCollections();
  const now = new Date();
  const group = normalizeGroupInput(payload);
  const workspaceId = String(
    payload.workspaceId || actor?.workspaceId || defaultWorkspace.id,
  );
  const workspace = await db.collection(COLLECTION_NAMES.WORKSPACES).findOne({
    id: workspaceId,
    status: "active",
  });
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (group.scope.type === "applications") {
    const applicationCount = await db
      .collection(COLLECTION_NAMES.APPLICATIONS)
      .countDocuments({
        id: { $in: group.scope.applicationIds },
        workspaceId,
        status: "active",
      });
    if (applicationCount !== group.scope.applicationIds.length) {
      throw createHttpError(
        422,
        "INVALID_GROUP_SCOPE",
        "All scoped applications must be active and belong to the workspace",
      );
    }
  }
  const document = {
    _id: randomUUID(),
    ...group,
    workspaceId,
    active: true,
    system: false,
    createdAt: now,
    createdBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
  };

  try {
    await groups.insertOne(document);
  } catch (error) {
    if (errorCode(error) === 11000) {
      if (
        error !== null &&
        typeof error === "object" &&
        "keyPattern" in error &&
        error.keyPattern !== null &&
        typeof error.keyPattern === "object" &&
        "identifier" in error.keyPattern
      ) {
        throw createHttpError(
          409,
          "GROUP_IDENTIFIER_CONFLICT",
          "Já existe um grupo com este identificador no workspace",
        );
      }
      throw createHttpError(
        409,
        "GROUP_NAME_CONFLICT",
        "A group with this name already exists",
      );
    }
    throw error;
  }
  return normalizeGroup(document);
}

export async function updatePermissionGroup(
  groupId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Actor,
) {
  const { db, groups, defaultWorkspace } = await getCollections();
  const workspaceId = String(
    payload.workspaceId || actor?.workspaceId || defaultWorkspace.id,
  );
  const current = await groups.findOne({
    _id: { $in: groupIdCandidates([groupId]) },
    workspaceId,
  });
  if (!current) {
    throw createHttpError(
      404,
      "GROUP_NOT_FOUND",
      `Group not found: ${groupId}`,
    );
  }
  const group = normalizeGroupInput(payload, current);
  if (group.scope.type === "applications") {
    const applicationCount = await db
      .collection(COLLECTION_NAMES.APPLICATIONS)
      .countDocuments({
        id: { $in: group.scope.applicationIds },
        workspaceId,
        status: "active",
      });
    if (applicationCount !== group.scope.applicationIds.length) {
      throw createHttpError(
        422,
        "INVALID_GROUP_SCOPE",
        "All scoped applications must be active and belong to the workspace",
      );
    }
  }
  try {
    const result = await groups.findOneAndUpdate(
      { _id: current._id, workspaceId },
      {
        $set: {
          ...group,
          updatedAt: new Date(),
          updatedBy: actor.userId,
        },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      throw createHttpError(
        404,
        "GROUP_NOT_FOUND",
        `Group not found: ${groupId}`,
      );
    }
    return normalizeGroup(result);
  } catch (error) {
    if (errorCode(error) === 11000) {
      if (
        error !== null &&
        typeof error === "object" &&
        "keyPattern" in error &&
        error.keyPattern !== null &&
        typeof error.keyPattern === "object" &&
        "identifier" in error.keyPattern
      ) {
        throw createHttpError(
          409,
          "GROUP_IDENTIFIER_CONFLICT",
          "Já existe um grupo com este identificador no workspace",
        );
      }
      throw createHttpError(
        409,
        "GROUP_NAME_CONFLICT",
        "A group with this name already exists",
      );
    }
    throw error;
  }
}

export async function setPermissionGroupActive(
  groupId: string | string[],
  active: boolean,
  actor: Partial<Actor>,
) {
  if (typeof active !== "boolean") {
    throw createHttpError(422, "INVALID_GROUP", "active must be a boolean");
  }
  const { groups, defaultWorkspace } = await getCollections();
  const workspaceId = String(actor?.workspaceId || defaultWorkspace.id);
  const result = await groups.findOneAndUpdate(
    { _id: { $in: groupIdCandidates([groupId]) }, workspaceId },
    {
      $set: {
        active,
        updatedAt: new Date(),
        updatedBy: actor.userId,
      },
    },
    { returnDocument: "after" },
  );
  if (!result) {
    throw createHttpError(
      404,
      "GROUP_NOT_FOUND",
      `Group not found: ${groupId}`,
    );
  }
  return normalizeGroup(result);
}
