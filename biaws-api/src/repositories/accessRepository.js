import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

import {
  assertKnownPermissions,
  getPermissionScope,
  PERMISSION_CATALOG,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { ensureDefaultWorkspace } from "./catalogRepository.js";

const GROUPS_COLLECTION = COLLECTION_NAMES.PERMISSION_GROUPS;
const USER_ACCESS_COLLECTION = COLLECTION_NAMES.WORKSPACE_MEMBERSHIPS;
const MAX_SCOPE_APPLICATIONS = 250;

const permissionIds = PERMISSION_CATALOG.map(({ id }) => id);
const permissionsStartingWith = (...prefixes) =>
  permissionIds.filter((id) =>
    prefixes.some((prefix) => id.startsWith(prefix)),
  );

export const INITIAL_PERMISSION_GROUPS = Object.freeze([
  {
    id: "administration",
    name: "Administração",
    description:
      "Acesso integral à administração e aos domínios do Bondia Workspaces.",
    permissions: permissionIds,
  },
  {
    id: "incident-management",
    name: "Gestão de chamados",
    description: "Gerenciamento completo de chamados e seus anexos.",
    permissions: [
      "workspaces.read",
      "applications.read",
      "components.read",
      ...permissionsStartingWith("issues."),
    ],
  },
  {
    id: "demand-management",
    name: "Gestão de melhorias",
    description: "Gerenciamento completo de melhorias, tarefas e anexos.",
    permissions: permissionsStartingWith("demands.", "tasks."),
  },
  {
    id: "knowledge-management",
    name: "Gestão de conhecimento",
    description:
      "Gerenciamento de taxonomia, procedimentos, regras, decisões e skills.",
    permissions: permissionsStartingWith(
      "taxonomy.",
      "procedures.",
      "documents.",
      "skills.",
    ).concat("applications.read", "components.read"),
  },
  {
    id: "support",
    name: "Chamados",
    description: "Consulta, comentários e atualização de status de chamados.",
    permissions: [
      "issues.read",
      "issues.status.update",
      "issues.comment.create",
      "issues.comment.update",
      "issues.attachment.read",
    ],
  },
  {
    id: "improvement-development",
    name: "Desenvolvimento de melhorias",
    description:
      "Leitura de melhorias e colaboração em tarefas e especificações.",
    permissions: [
      "demands.read",
      "demands.specification.update",
      "demands.attachment.read",
      "tasks.status.update",
      "tasks.note.create",
      "tasks.attachment.read",
      "tasks.attachment.create",
    ],
  },
  {
    id: "agent-operator",
    name: "Agente operacional",
    description:
      "Operações estruturadas expostas pelo MCP, sem administração de identidades, permissões ou auditoria.",
    permissions: [
      "workspaces.read",
      "applications.read",
      "applications.create",
      "applications.update",
      "integrations.read",
      "integrations.create",
      "integrations.update",
      "components.read",
      "components.create",
      "components.update",
      "repositories.read",
      "repositories.create",
      "repositories.update",
      "servers.read",
      "servers.create",
      "servers.update",
      "deployments.read",
      "deployments.create",
      "deployments.update",
      "runtimes.read",
      "runtimes.create",
      "runtimes.update",
      "monitoring.signals.create",
      "issues.read",
      "issues.create",
      "issues.update",
      "issues.status.update",
      "issues.classification.update",
      "issues.comment.create",
      "issues.comment.update",
      "issues.attachment.read",
      "issues.attachment.create",
      "issues.attachment.update",
      "issues.attachment.delete",
      "issues.import.eml",
      "demands.read",
      "demands.create",
      "demands.update",
      "demands.note.create",
      "demands.specification.update",
      "demands.attachment.read",
      "demands.attachment.create",
      "demands.attachment.update",
      "demands.attachment.delete",
      "tasks.create",
      "tasks.update",
      "tasks.status.update",
      "tasks.delete",
      "tasks.note.create",
      "tasks.note.update",
      "tasks.note.delete",
      "tasks.attachment.read",
      "taxonomy.read",
      "taxonomy.manage",
      "procedures.read",
      "procedures.create",
      "procedures.update",
      "procedures.attachment.read",
      "procedures.attachment.create",
      "procedures.attachment.update",
      "procedures.attachment.delete",
      "documents.read",
      "documents.create",
      "documents.update",
      "skills.read",
      "secrets.metadata.read",
      "secrets.metadata.create",
    ],
  },
]);

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizedName(name) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

function compareStrings(left, right) {
  return String(left).localeCompare(String(right));
}

function identityIdCandidates(userId) {
  const candidates = [userId];
  if (ObjectId.isValid(userId)) candidates.push(new ObjectId(userId));
  return candidates;
}

function groupIdCandidates(groupIds) {
  return [...new Set(groupIds.map(String))].flatMap((groupId) =>
    ObjectId.isValid(groupId) ? [groupId, new ObjectId(groupId)] : [groupId],
  );
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    throw createHttpError(422, "INVALID_GROUP", "permissions must be an array");
  }

  const normalized = [...new Set(permissions)].sort(compareStrings);
  try {
    assertKnownPermissions(normalized);
  } catch (error) {
    throw createHttpError(422, "UNKNOWN_PERMISSION", error.message);
  }
  return normalized;
}

function normalizeGroupScope(value, permissions, current = null) {
  const type = String(value?.type || current?.type || "workspace").trim();
  if (!["workspace", "applications"].includes(type)) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      "scope.type must be workspace or applications",
    );
  }
  const applicationIds =
    type === "applications"
      ? [
          ...new Set(
            (value?.applicationIds ?? current?.applicationIds ?? [])
              .map((id) => String(id || "").trim())
              .filter(Boolean),
          ),
        ]
      : [];
  if (type === "applications" && !applicationIds.length) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      "application-scoped groups require at least one application",
    );
  }
  if (applicationIds.length > MAX_SCOPE_APPLICATIONS) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      `scope.applicationIds must contain at most ${MAX_SCOPE_APPLICATIONS} items`,
    );
  }
  const incompatible = permissions.filter(
    (permission) => getPermissionScope(permission) === "workspace",
  );
  if (type === "applications" && incompatible.length) {
    throw createHttpError(
      422,
      "WORKSPACE_PERMISSION_REQUIRES_WORKSPACE_SCOPE",
      `Workspace permissions cannot be application-scoped: ${incompatible.join(", ")}`,
    );
  }
  return { type, applicationIds };
}

export function normalizeGroupInput(payload = {}, current = null) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const description =
    typeof payload.description === "string" ? payload.description.trim() : "";

  if (!name || name.length > 100) {
    throw createHttpError(
      422,
      "INVALID_GROUP",
      "name must contain between 1 and 100 characters",
    );
  }
  if (description.length > 500) {
    throw createHttpError(
      422,
      "INVALID_GROUP",
      "description must contain at most 500 characters",
    );
  }

  const permissions = normalizePermissions(payload.permissions);
  return {
    name,
    normalizedName: normalizedName(name),
    description,
    permissions,
    scope: normalizeGroupScope(payload.scope, permissions, current?.scope),
  };
}

export function calculateEffectivePermissions(groups = []) {
  return [
    ...new Set(
      groups
        .filter((group) => group.active !== false)
        .flatMap((group) => group.permissions || []),
    ),
  ].sort(compareStrings);
}

function normalizeGroup(document) {
  if (!document) return null;
  return {
    id: String(document._id),
    name: document.name,
    description: document.description || "",
    permissions: document.permissions || [],
    workspaceId: String(document.workspaceId || ""),
    scope: {
      type:
        document.scope?.type === "applications" ? "applications" : "workspace",
      applicationIds:
        document.scope?.type === "applications"
          ? [...new Set(document.scope.applicationIds || [])]
          : [],
    },
    active: document.active !== false,
    system: document.system === true,
    systemKey: document.systemKey || "",
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function systemGroupId(workspace, groupId) {
  return workspace.default ? groupId : `${workspace.id}:${groupId}`;
}

export function buildSystemGroupSeedPipeline(
  group,
  workspace,
  actor = {},
  now = new Date(),
) {
  const initialPermissions = [...group.permissions].sort(compareStrings);
  const preserveOrInitialize = (field, initialValue) => ({
    $ifNull: [`$${field}`, initialValue],
  });

  return [
    {
      $set: {
        name: preserveOrInitialize("name", group.name),
        normalizedName: preserveOrInitialize(
          "normalizedName",
          normalizedName(group.name),
        ),
        description: preserveOrInitialize("description", group.description),
        permissions: preserveOrInitialize("permissions", initialPermissions),
        workspaceId: workspace.id,
        scope: preserveOrInitialize("scope", {
          type: "workspace",
          applicationIds: [],
        }),
        active: preserveOrInitialize("active", true),
        system: true,
        systemKey: group.id,
        createdAt: preserveOrInitialize("createdAt", now),
        createdBy: preserveOrInitialize("createdBy", actor.userId || "system"),
        updatedAt: preserveOrInitialize("updatedAt", now),
        updatedBy: preserveOrInitialize("updatedBy", actor.userId || "system"),
      },
    },
  ];
}

async function upsertInitialPermissionGroups(groups, workspace, actor = {}) {
  const now = new Date();
  await Promise.all(
    INITIAL_PERMISSION_GROUPS.map((group) =>
      groups.updateOne(
        { _id: systemGroupId(workspace, group.id) },
        buildSystemGroupSeedPipeline(group, workspace, actor, now),
        { upsert: true },
      ),
    ),
  );
}

async function getCollections() {
  const db = await getMongoDatabase();
  const groups = db.collection(GROUPS_COLLECTION);
  const userAccess = db.collection(USER_ACCESS_COLLECTION);
  const users = db.collection(COLLECTION_NAMES.AUTH_USERS);
  const workspace = await ensureDefaultWorkspace();

  const groupIndexes = await groups.indexes().catch(() => []);
  const accessIndexes = await userAccess.indexes().catch(() => []);
  const legacyNameIndex = groupIndexes.find(
    ({ name, key, unique }) =>
      unique && name === "normalizedName_1" && key?.normalizedName === 1,
  );
  if (legacyNameIndex) await groups.dropIndex(legacyNameIndex.name);
  const legacyUserIndex = accessIndexes.find(
    ({ name, key, unique }) =>
      unique && name === "userId_1" && key?.userId === 1,
  );
  if (legacyUserIndex) await userAccess.dropIndex(legacyUserIndex.name);
  await Promise.all([
    groups.createIndex(
      { workspaceId: 1, normalizedName: 1 },
      { unique: true, name: "workspace_group_name_unique" },
    ),
    groups.createIndex({ workspaceId: 1, active: 1, name: 1 }),
    userAccess.createIndex(
      { userId: 1, workspaceId: 1 },
      { unique: true, name: "user_workspace_access_unique" },
    ),
    userAccess.createIndex({ workspaceId: 1, groupIds: 1 }),
  ]);

  await upsertInitialPermissionGroups(groups, workspace);

  return { db, groups, userAccess, users, defaultWorkspace: workspace };
}

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

export async function ensureWorkspacePermissionGroups(workspaceId, actor = {}) {
  const { db, groups } = await getCollections();
  const workspace = await db.collection(COLLECTION_NAMES.WORKSPACES).findOne({
    id: String(workspaceId),
    status: "active",
  });
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  await upsertInitialPermissionGroups(groups, workspace, actor);
  return listPermissionGroups({ workspaceId: workspace.id });
}

export async function createPermissionGroup(payload, actor) {
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
    if (error?.code === 11000) {
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

export async function updatePermissionGroup(groupId, payload, actor) {
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
    if (error?.code === 11000) {
      throw createHttpError(
        409,
        "GROUP_NAME_CONFLICT",
        "A group with this name already exists",
      );
    }
    throw error;
  }
}

export async function setPermissionGroupActive(groupId, active, actor) {
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

export async function getUserAccess(userId, { workspaceId } = {}) {
  const { userAccess, defaultWorkspace } = await getCollections();
  const effectiveWorkspaceId = String(workspaceId || defaultWorkspace.id);
  const document = await userAccess.findOne({
    userId,
    workspaceId: effectiveWorkspaceId,
  });
  return {
    userId,
    workspaceId: effectiveWorkspaceId,
    groupIds: document?.groupIds || [],
  };
}

export async function getUsersAccess(userIds, { workspaceId } = {}) {
  const normalizedUserIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((userId) => String(userId || "").trim())
        .filter(Boolean),
    ),
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

export async function setUserGroups(
  userId,
  groupIds,
  actor,
  { workspaceId } = {},
) {
  if (!Array.isArray(groupIds)) {
    throw createHttpError(
      422,
      "INVALID_USER_GROUPS",
      "groupIds must be an array",
    );
  }
  const normalizedGroupIds = [...new Set(groupIds.map(String))];
  const { groups, userAccess, users, defaultWorkspace } =
    await getCollections();
  const effectiveWorkspaceId = String(
    workspaceId || actor?.workspaceId || defaultWorkspace.id,
  );
  const userExists = await users.countDocuments(
    { _id: { $in: identityIdCandidates(userId) } },
    { limit: 1 },
  );
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
    throw createHttpError(
      422,
      "INVALID_USER_GROUPS",
      "All associated groups must exist and be active",
    );
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
  const administrationGroupId = administrationGroup
    ? String(administrationGroup._id)
    : "";
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
      throw createHttpError(
        409,
        "LAST_WORKSPACE_ADMIN",
        "The last workspace administrator cannot be removed",
      );
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

export async function removeUserAccess(userId, workspaceId) {
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
  if (
    administrationGroup &&
    access.groupIds?.includes(String(administrationGroup._id))
  ) {
    const administratorCount = await userAccess.countDocuments({
      workspaceId: effectiveWorkspaceId,
      groupIds: String(administrationGroup._id),
    });
    if (administratorCount <= 1) {
      throw createHttpError(
        409,
        "LAST_WORKSPACE_ADMIN",
        "The last workspace administrator cannot be removed",
      );
    }
  }
  const result = await userAccess.deleteOne({
    userId: String(userId),
    workspaceId: effectiveWorkspaceId,
  });
  return result.deletedCount === 1;
}

export function calculatePermissionScopes(groups) {
  const scopes = {};
  for (const group of groups.filter(({ active }) => active !== false)) {
    for (const permission of group.permissions || []) {
      const current = scopes[permission] || {
        workspace: false,
        applicationIds: [],
      };
      if (group.scope?.type === "workspace") {
        current.workspace = true;
        current.applicationIds = [];
      } else if (!current.workspace) {
        current.applicationIds = [
          ...new Set([
            ...current.applicationIds,
            ...(group.scope?.applicationIds || []),
          ]),
        ].sort(compareStrings);
      }
      scopes[permission] = current;
    }
  }
  return scopes;
}

export async function resolveUserAuthorization(
  userId,
  requestedWorkspaceId = "",
) {
  const { db, groups, userAccess } = await getCollections();
  const bindings = await userAccess.find({ userId }).toArray();
  const workspaceIds = [
    ...new Set(bindings.map(({ workspaceId }) => String(workspaceId))),
  ];
  const workspaces = workspaceIds.length
    ? await db
        .collection(COLLECTION_NAMES.WORKSPACES)
        .find({ id: { $in: workspaceIds }, status: "active" })
        .project({ _id: 0, id: 1, key: 1, name: 1 })
        .sort({ name: 1 })
        .toArray()
    : [];
  const selectedWorkspaceId =
    String(requestedWorkspaceId || "").trim() ||
    (workspaces.length === 1 ? workspaces[0].id : "");
  if (
    requestedWorkspaceId &&
    !workspaces.some(({ id }) => id === selectedWorkspaceId)
  ) {
    throw createHttpError(
      403,
      "WORKSPACE_FORBIDDEN",
      "The authenticated actor cannot access the requested workspace",
    );
  }
  const access = bindings.find(
    ({ workspaceId }) => String(workspaceId) === selectedWorkspaceId,
  );
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
  const normalizedGroups = groupDocuments.map(normalizeGroup);
  return {
    workspaceId: selectedWorkspaceId || null,
    workspaces,
    groups: normalizedGroups.map(({ id, name }) => ({ id, name })),
    permissions: calculateEffectivePermissions(normalizedGroups),
    permissionScopes: calculatePermissionScopes(normalizedGroups),
  };
}
