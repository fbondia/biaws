import { randomUUID } from "node:crypto";

import {
  APPLICATION_STATUSES,
  CATALOG_KEY_PATTERN,
  CATALOG_LIMITS,
  DEFAULT_WORKSPACE_KEY,
  DEFAULT_WORKSPACE_NAME,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { assertResourceCollection } from "./resourceCollectionsRepository.js";

export const WORKSPACES_COLLECTION = COLLECTION_NAMES.WORKSPACES;
export const APPLICATIONS_COLLECTION = COLLECTION_NAMES.APPLICATIONS;

let collectionsPromise;

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function actorId(actor) {
  return String(actor?.userId || actor?.email || "system").trim();
}

function requiredText(value, field, limit) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} is required`,
    );
  }
  if (normalized.length > limit) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must contain at most ${limit} characters`,
    );
  }
  return normalized;
}

function optionalText(value, field, limit) {
  const normalized = String(value || "").trim();
  if (normalized.length > limit) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must contain at most ${limit} characters`,
    );
  }
  return normalized;
}

function normalizeKey(value) {
  const key = requiredText(value, "key", CATALOG_LIMITS.key).toLowerCase();
  if (!CATALOG_KEY_PATTERN.test(key)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_KEY",
      "key must use lowercase letters, numbers and single hyphens",
    );
  }
  return key;
}

function normalizeTags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "tags must be an array",
    );
  }
  if (value.length > CATALOG_LIMITS.tags) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `tags must contain at most ${CATALOG_LIMITS.tags} items`,
    );
  }
  const tags = value.map((tag, index) =>
    requiredText(tag, `tags[${index}]`, CATALOG_LIMITS.tag),
  );
  const unique = new Map();
  for (const tag of tags) {
    const normalizedKey = tag.toLocaleLowerCase("pt-BR");
    if (!unique.has(normalizedKey)) unique.set(normalizedKey, tag);
  }
  return [...unique.values()];
}

function normalizeLinks(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "links must be an array",
    );
  }
  if (value.length > CATALOG_LIMITS.links) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `links must contain at most ${CATALOG_LIMITS.links} items`,
    );
  }
  return value.map((link, index) => {
    const label = requiredText(
      link?.label,
      `links[${index}].label`,
      CATALOG_LIMITS.linkLabel,
    );
    const rawUrl = requiredText(
      link?.url,
      `links[${index}].url`,
      CATALOG_LIMITS.linkUrl,
    );
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw createHttpError(
        422,
        "INVALID_CATALOG_URL",
        `links[${index}].url must be a valid URL`,
      );
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw createHttpError(
        422,
        "INVALID_CATALOG_URL",
        `links[${index}].url must use HTTP(S) without embedded credentials`,
      );
    }
    return { label, url: url.toString() };
  });
}

function normalizeOwner(value, current = {}) {
  if (value === undefined) return current;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "owner must be an object",
    );
  }
  return {
    team: optionalText(value.team, "owner.team", CATALOG_LIMITS.ownerTeam),
    contact: optionalText(
      value.contact,
      "owner.contact",
      CATALOG_LIMITS.ownerContact,
    ),
  };
}

function normalizeDocument(document) {
  if (!document) return null;
  const { _id, ...value } = document;
  return value;
}

export function normalizeApplicationInput(payload = {}, current = null) {
  const allowedFields = new Set([
    "key",
    "name",
    "description",
    "owner",
    "tags",
    "links",
  ]);
  const unknownFields = Object.keys(payload).filter(
    (field) => !allowedFields.has(field),
  );
  if (unknownFields.length) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `unknown application fields: ${unknownFields.join(", ")}`,
    );
  }
  const key = normalizeKey(payload.key ?? current?.key);

  return {
    key,
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      CATALOG_LIMITS.description,
    ),
    owner: normalizeOwner(payload.owner, current?.owner),
    tags: normalizeTags(payload.tags) ?? current?.tags ?? [],
    links: normalizeLinks(payload.links) ?? current?.links ?? [],
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildApplicationFilter(workspaceId, query = {}) {
  const filter = { workspaceId: String(workspaceId) };
  if (query.collectionId !== undefined) {
    const collectionId = String(query.collectionId || "").trim();
    filter.collectionId = collectionId || { $in: ["", null] };
  }
  if (query.status) {
    if (!APPLICATION_STATUSES.includes(query.status)) {
      throw createHttpError(
        422,
        "INVALID_APPLICATION_STATUS",
        `status must be one of: ${APPLICATION_STATUSES.join(", ")}`,
      );
    }
    filter.status = query.status;
  } else if (String(query.includeArchived || "").toLowerCase() !== "true") {
    filter.status = "active";
  }
  const search = String(query.q || "").trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "iu");
    filter.$or = [
      { key: pattern },
      { name: pattern },
      { description: pattern },
    ];
  }
  return filter;
}

export function buildOperationalWorkspaceFilter(workspaceId) {
  return {
    id: String(workspaceId),
  };
}

async function getCollections() {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const db = await getMongoDatabase();
      const workspaces = db.collection(WORKSPACES_COLLECTION);
      const applications = db.collection(APPLICATIONS_COLLECTION);
      await Promise.all([
        workspaces.createIndex({ id: 1 }, { unique: true }),
        workspaces.createIndex({ key: 1 }, { unique: true }),
        workspaces.createIndex(
          { default: 1 },
          { unique: true, partialFilterExpression: { default: true } },
        ),
        applications.createIndex({ id: 1 }, { unique: true }),
        applications.createIndex({ workspaceId: 1, key: 1 }, { unique: true }),
        applications.createIndex({
          workspaceId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
        applications.createIndex({ workspaceId: 1, name: 1, id: 1 }),
        applications.createIndex({
          workspaceId: 1,
          collectionId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
      ]);
      return { db, workspaces, applications };
    })().catch((error) => {
      collectionsPromise = undefined;
      throw error;
    });
  }
  return collectionsPromise;
}

export async function ensureDefaultWorkspace(actor = {}) {
  const { workspaces } = await getCollections();
  const now = new Date();
  await workspaces.updateOne(
    { key: DEFAULT_WORKSPACE_KEY },
    {
      $setOnInsert: {
        id: randomUUID(),
        key: DEFAULT_WORKSPACE_KEY,
        name: DEFAULT_WORKSPACE_NAME,
        description:
          "Workspace padrão criado pelo bootstrap do Bondia Workspaces.",
        status: "active",
        default: true,
        settings: {},
        createdAt: now,
        createdBy: actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
      },
    },
    { upsert: true },
  );
  return normalizeDocument(
    await workspaces.findOne({ key: DEFAULT_WORKSPACE_KEY }),
  );
}

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

export async function createWorkspace(payload = {}, actor = {}) {
  const { workspaces } = await getCollections();
  const key = normalizeKey(payload.key);
  const name = requiredText(payload.name, "name", CATALOG_LIMITS.name);
  const description = optionalText(
    payload.description,
    "description",
    CATALOG_LIMITS.description,
  );
  const now = new Date();
  const document = {
    id: randomUUID(),
    key,
    name,
    description,
    status: "active",
    default: false,
    settings: {},
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await workspaces.insertOne(document);
  } catch (error) {
    if (error?.code === 11000) {
      throw createHttpError(
        409,
        "WORKSPACE_KEY_CONFLICT",
        "A workspace with this key already exists",
      );
    }
    throw error;
  }
  return normalizeDocument(document);
}

export async function getWorkspace(workspaceId) {
  const { workspaces } = await getCollections();
  await ensureDefaultWorkspace();
  return normalizeDocument(
    await workspaces.findOne(buildOperationalWorkspaceFilter(workspaceId)),
  );
}

export async function updateWorkspace(workspaceId, payload = {}, actor = {}) {
  const allowed = new Set(["name", "description"]);
  const unknown = Object.keys(payload).filter((field) => !allowed.has(field));
  if (unknown.length) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `Unknown workspace fields: ${unknown.join(", ")}`,
    );
  }
  const current = await getWorkspace(workspaceId);
  if (!current) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const changes = {};
  if (Object.hasOwn(payload, "name")) {
    changes.name = requiredText(payload.name, "name", CATALOG_LIMITS.name);
  }
  if (Object.hasOwn(payload, "description")) {
    changes.description = optionalText(
      payload.description,
      "description",
      CATALOG_LIMITS.description,
    );
  }
  const { workspaces } = await getCollections();
  const result = await workspaces.findOneAndUpdate(
    { id: current.id },
    {
      $set: {
        ...changes,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
    { returnDocument: "after" },
  );
  return normalizeDocument(result);
}

export async function setWorkspaceStatus(workspaceId, status, actor = {}) {
  if (!["active", "archived"].includes(status)) {
    throw createHttpError(
      422,
      "INVALID_WORKSPACE_STATUS",
      "Invalid workspace status",
    );
  }
  const current = await getWorkspace(workspaceId);
  if (!current) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (current.default && status === "archived") {
    throw createHttpError(
      409,
      "DEFAULT_WORKSPACE_REQUIRED",
      "The default workspace cannot be archived",
    );
  }
  const { workspaces } = await getCollections();
  const result = await workspaces.findOneAndUpdate(
    { id: current.id },
    {
      $set: {
        status,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
    { returnDocument: "after" },
  );
  return normalizeDocument(result);
}

async function requireWorkspace(workspaceId, { active = false } = {}) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (active && workspace.status !== "active") {
    throw createHttpError(409, "WORKSPACE_ARCHIVED", "Workspace is archived");
  }
  return workspace;
}

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

function duplicateApplicationError(error) {
  if (error?.code !== 11000) throw error;
  throw createHttpError(
    409,
    "APPLICATION_KEY_CONFLICT",
    "An application with this key already exists in the workspace",
  );
}

export async function createApplication(workspaceId, payload = {}, actor = {}) {
  await requireWorkspace(workspaceId, { active: true });
  const { applications } = await getCollections();
  const normalized = normalizeApplicationInput(payload);
  const now = new Date();
  const document = {
    id: randomUUID(),
    workspaceId: String(workspaceId),
    ...normalized,
    status: "active",
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await applications.insertOne(document);
  } catch (error) {
    duplicateApplicationError(error);
  }
  return normalizeDocument(document);
}

export async function updateApplication(
  applicationId,
  payload = {},
  actor = {},
) {
  const { applications } = await getCollections();
  const current = await getApplication(applicationId);
  if (!current) {
    throw createHttpError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  if (current.status !== "active") {
    throw createHttpError(
      409,
      "APPLICATION_ARCHIVED",
      "Application is archived",
    );
  }
  const normalized = normalizeApplicationInput(payload, current);
  const updatedAt = new Date();
  try {
    await applications.updateOne(
      { id: current.id, workspaceId: current.workspaceId, status: "active" },
      {
        $set: {
          ...normalized,
          updatedAt,
          updatedBy: actorId(actor),
        },
      },
    );
  } catch (error) {
    duplicateApplicationError(error);
  }
  return getApplication(current.id);
}

export async function archiveApplication(applicationId, actor = {}) {
  const { applications } = await getCollections();
  const current = await getApplication(applicationId);
  if (!current) {
    throw createHttpError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  if (current.status === "archived") return current;
  await applications.updateOne(
    { id: current.id, workspaceId: current.workspaceId },
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
        archivedBy: actorId(actor),
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
  );
  return getApplication(current.id);
}

export async function restoreApplication(applicationId, actor = {}) {
  const { applications } = await getCollections();
  const current = await getApplication(applicationId);
  if (!current) {
    throw createHttpError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  if (current.status !== "archived") return current;
  const workspace = await getWorkspace(current.workspaceId);
  if (!workspace || workspace.status !== "active") {
    throw createHttpError(
      409,
      "WORKSPACE_ARCHIVED",
      "Reactivate the workspace before restoring the application",
    );
  }
  const now = new Date();
  await applications.updateOne(
    { id: current.id, workspaceId: current.workspaceId, status: "archived" },
    {
      $set: {
        status: "active",
        updatedAt: now,
        updatedBy: actorId(actor),
      },
      $unset: { archivedAt: "", archivedBy: "" },
    },
  );
  return getApplication(current.id);
}

export function applicationDeletionDependencies(application) {
  const scope = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  return [
    ["componentes", COLLECTION_NAMES.APPLICATION_COMPONENTS, scope],
    [
      "integrações",
      COLLECTION_NAMES.APPLICATION_INTEGRATIONS,
      {
        workspaceId: application.workspaceId,
        $or: [
          { applicationId: application.id },
          { targetApplicationId: application.id },
        ],
      },
    ],
    ["repositórios", COLLECTION_NAMES.APPLICATION_REPOSITORIES, scope],
    ["deployments", COLLECTION_NAMES.APPLICATION_DEPLOYMENTS, scope],
    ["runtimes", COLLECTION_NAMES.DEPLOYMENT_RUNTIMES, scope],
    ["documentos", COLLECTION_NAMES.DOCUMENTS, scope],
    ["issues", COLLECTION_NAMES.ISSUES, scope],
    ["demandas", COLLECTION_NAMES.REQUESTS, scope],
    ["segredos", COLLECTION_NAMES.SECRETS, scope],
  ];
}

export async function deleteApplication(applicationId) {
  const { applications, db } = await getCollections();
  const current = await getApplication(applicationId);
  if (!current) {
    throw createHttpError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  if (current.status !== "archived") {
    throw createHttpError(
      409,
      "APPLICATION_NOT_ARCHIVED",
      "Only archived applications can be permanently deleted",
    );
  }
  const dependencies = applicationDeletionDependencies(current);
  const counts = await Promise.all(
    dependencies.map(([, collection, filter]) =>
      db.collection(collection).countDocuments(filter, { limit: 1 }),
    ),
  );
  const blocking = dependencies
    .filter((_, index) => counts[index] > 0)
    .map(([label]) => label);
  if (blocking.length) {
    throw createHttpError(
      409,
      "APPLICATION_HAS_DEPENDENCIES",
      `Remova as dependências antes de excluir a aplicação: ${blocking.join(", ")}`,
    );
  }
  const result = await applications.deleteOne({
    id: current.id,
    workspaceId: current.workspaceId,
    status: "archived",
  });
  if (!result.deletedCount) {
    throw createHttpError(
      409,
      "APPLICATION_DELETE_CONFLICT",
      "Application was not deleted",
    );
  }
  await db
    .collection(COLLECTION_NAMES.APPLICATION_TOPOLOGY_DIAGRAMS)
    .deleteMany({
      workspaceId: current.workspaceId,
      applicationId: current.id,
    });
  return current;
}

export async function moveApplicationToCollection(
  applicationId,
  collectionId,
  actor = {},
) {
  const { applications } = await getCollections();
  const current = await getApplication(applicationId);
  if (!current) {
    throw createHttpError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  const normalizedCollectionId = await assertResourceCollection(
    "applications",
    collectionId,
    current.workspaceId,
  );
  await applications.updateOne(
    { id: current.id, workspaceId: current.workspaceId },
    {
      $set: {
        collectionId: normalizedCollectionId,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
  );
  return getApplication(current.id);
}
