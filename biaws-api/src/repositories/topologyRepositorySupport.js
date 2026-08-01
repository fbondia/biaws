import {
  CATALOG_KEY_PATTERN,
  CATALOG_LIMITS,
  CATALOG_METADATA_KEY_PATTERN,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getApplication, getWorkspace } from "./catalogRepository.js";

export const COMPONENTS_COLLECTION = COLLECTION_NAMES.APPLICATION_COMPONENTS;
export const REPOSITORIES_COLLECTION =
  COLLECTION_NAMES.APPLICATION_REPOSITORIES;
export const SERVERS_COLLECTION = COLLECTION_NAMES.SERVERS;
export const DEPLOYMENTS_COLLECTION = COLLECTION_NAMES.APPLICATION_DEPLOYMENTS;
export const RUNTIMES_COLLECTION = COLLECTION_NAMES.DEPLOYMENT_RUNTIMES;

const PROHIBITED_METADATA_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;

let collectionsPromise;

export function createCatalogError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function actorId(actor) {
  return String(actor?.userId || actor?.email || "system").trim();
}

export function normalizeDocument(document) {
  if (!document) return null;
  const { _id, ...value } = document;
  return value;
}

export function assertAllowedFields(payload, allowedFields, entity) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${entity} payload must be an object`,
    );
  }
  const unknown = Object.keys(payload).filter(
    (field) => !allowedFields.includes(field),
  );
  if (unknown.length) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `unknown ${entity} fields: ${unknown.join(", ")}`,
    );
  }
}

export function requiredText(value, field, limit = CATALOG_LIMITS.name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} is required`,
    );
  }
  if (normalized.length > limit) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must contain at most ${limit} characters`,
    );
  }
  return normalized;
}

export function optionalText(value, field, limit = CATALOG_LIMITS.description) {
  if (value === undefined || value === null) return "";
  const normalized = String(value).trim();
  if (normalized.length > limit) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must contain at most ${limit} characters`,
    );
  }
  return normalized;
}

export function normalizeKey(value, currentKey) {
  const key = requiredText(
    value ?? currentKey,
    "key",
    CATALOG_LIMITS.key,
  ).toLowerCase();
  if (!CATALOG_KEY_PATTERN.test(key)) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_KEY",
      "key must use lowercase letters, numbers and single hyphens",
    );
  }
  return key;
}

export function normalizeEnum(value, field, allowed, fallback) {
  const normalized = String(value ?? fallback ?? "").trim();
  if (!allowed.includes(normalized)) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must be one of: ${allowed.join(", ")}`,
    );
  }
  return normalized;
}

export function normalizeTags(value, current = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > CATALOG_LIMITS.tags) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `tags must be an array with at most ${CATALOG_LIMITS.tags} items`,
    );
  }
  const unique = new Map();
  value.forEach((tag, index) => {
    const normalized = requiredText(tag, `tags[${index}]`, CATALOG_LIMITS.tag);
    const identity = normalized.toLocaleLowerCase("pt-BR");
    if (!unique.has(identity)) unique.set(identity, normalized);
  });
  return [...unique.values()];
}

export function normalizeStringArray(
  value,
  field,
  { limit = 25, itemLimit = CATALOG_LIMITS.address, current = [] } = {},
) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > limit) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must be an array with at most ${limit} items`,
    );
  }
  return [
    ...new Set(
      value.map((item, index) =>
        requiredText(item, `${field}[${index}]`, itemLimit),
      ),
    ),
  ];
}

export function normalizeHttpUrl(
  value,
  field,
  { required = false, current = "" } = {},
) {
  const raw = required
    ? requiredText(value ?? current, field, CATALOG_LIMITS.linkUrl)
    : optionalText(value ?? current, field, CATALOG_LIMITS.linkUrl);
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_URL",
      `${field} must be a valid URL`,
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_URL",
      `${field} must use HTTP(S)`,
    );
  }
  assertCredentialFreeUrl(url, field);
  return url.toString();
}

export function assertCredentialFreeUrl(url, field) {
  const sensitiveQueryParameter = [...url.searchParams.keys()].find((key) =>
    PROHIBITED_METADATA_KEY.test(key),
  );
  if (
    url.username ||
    url.password ||
    sensitiveQueryParameter ||
    PROHIBITED_METADATA_KEY.test(url.hash)
  ) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_URL",
      `${field} cannot contain embedded credentials or secret parameters`,
    );
  }
}

export function normalizeDate(value, field, current = null) {
  if (value === undefined) return current ?? null;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must be a valid ISO date`,
    );
  }
  return date;
}

export function normalizeOptionalPort(value, current = null) {
  if (value === undefined) return current ?? null;
  if (value === null || value === "") return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "port must be an integer between 1 and 65535",
    );
  }
  return port;
}

function normalizeMetadataValue(value, field) {
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value === "string") {
    return optionalText(value, field, CATALOG_LIMITS.metadataString);
  }
  if (Array.isArray(value)) {
    if (value.length > CATALOG_LIMITS.metadataArrayItems) {
      throw createCatalogError(
        422,
        "INVALID_RUNTIME_METADATA",
        `${field} must contain at most ${CATALOG_LIMITS.metadataArrayItems} items`,
      );
    }
    return value.map((item, index) => {
      if (item !== null && typeof item === "object") {
        throw createCatalogError(
          422,
          "INVALID_RUNTIME_METADATA",
          `${field}[${index}] must be a scalar`,
        );
      }
      return normalizeMetadataValue(item, `${field}[${index}]`);
    });
  }
  throw createCatalogError(
    422,
    "INVALID_RUNTIME_METADATA",
    `${field} must be a scalar or an array of scalars`,
  );
}

export function normalizeMetadata(value, current = {}) {
  if (value === undefined) return current;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_METADATA",
      "metadata must be an object",
    );
  }
  const entries = Object.entries(value);
  if (entries.length > CATALOG_LIMITS.metadataEntries) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_METADATA",
      `metadata must contain at most ${CATALOG_LIMITS.metadataEntries} entries`,
    );
  }
  const normalized = {};
  for (const [key, entry] of entries) {
    if (
      !CATALOG_METADATA_KEY_PATTERN.test(key) ||
      PROHIBITED_METADATA_KEY.test(key)
    ) {
      throw createCatalogError(
        422,
        "INVALID_RUNTIME_METADATA",
        `metadata key is invalid or prohibited: ${key}`,
      );
    }
    normalized[key] = normalizeMetadataValue(entry, `metadata.${key}`);
  }
  if (
    Buffer.byteLength(JSON.stringify(normalized), "utf8") >
    CATALOG_LIMITS.metadataBytes
  ) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_METADATA",
      `metadata must contain at most ${CATALOG_LIMITS.metadataBytes} bytes`,
    );
  }
  return normalized;
}

export function pagination(query = {}) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 50);
  if (!Number.isInteger(page) || page < 1) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAGINATION",
      "page must be a positive integer",
    );
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAGINATION",
      "limit must be a positive integer",
    );
  }
  const safeLimit = Math.min(limit, CATALOG_LIMITS.pageSize);
  return { page, limit: safeLimit, skip: (page - 1) * safeLimit };
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function buildScopedListFilter({
  workspaceId,
  applicationId,
  statuses,
  query = {},
  searchFields = ["key", "name", "description"],
}) {
  const filter = { workspaceId: String(workspaceId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (query.status) {
    filter.status = normalizeEnum(query.status, "status", statuses);
  } else if (String(query.includeArchived || "").toLowerCase() !== "true") {
    filter.status =
      statuses.length === 2 && statuses.includes("active")
        ? "active"
        : { $ne: "archived" };
  }
  const search = String(query.q || "").trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "iu");
    filter.$or = searchFields.map((field) => ({ [field]: pattern }));
  }
  return filter;
}

export async function getTopologyCollections() {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const db = await getMongoDatabase();
      const components = db.collection(COMPONENTS_COLLECTION);
      const repositories = db.collection(REPOSITORIES_COLLECTION);
      const servers = db.collection(SERVERS_COLLECTION);
      const deployments = db.collection(DEPLOYMENTS_COLLECTION);
      const runtimes = db.collection(RUNTIMES_COLLECTION);
      await Promise.all([
        components.createIndex({ id: 1 }, { unique: true }),
        components.createIndex(
          { workspaceId: 1, applicationId: 1, key: 1 },
          { unique: true },
        ),
        components.createIndex({
          workspaceId: 1,
          applicationId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
        components.createIndex({
          workspaceId: 1,
          applicationId: 1,
          name: 1,
          id: 1,
        }),
        components.createIndex({
          workspaceId: 1,
          applicationId: 1,
          "repositoryLinks.repositoryId": 1,
        }),
        components.createIndex({
          workspaceId: 1,
          applicationId: 1,
          "dependencies.componentId": 1,
        }),
        repositories.createIndex({ id: 1 }, { unique: true }),
        repositories.createIndex(
          { workspaceId: 1, applicationId: 1, key: 1 },
          { unique: true },
        ),
        repositories.createIndex({
          workspaceId: 1,
          applicationId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
        repositories.createIndex({
          workspaceId: 1,
          applicationId: 1,
          name: 1,
          id: 1,
        }),
        servers.createIndex({ id: 1 }, { unique: true }),
        servers.createIndex({ workspaceId: 1, key: 1 }, { unique: true }),
        servers.createIndex({ workspaceId: 1, status: 1, name: 1, id: 1 }),
        servers.createIndex({ workspaceId: 1, name: 1, id: 1 }),
        deployments.createIndex({ id: 1 }, { unique: true }),
        deployments.createIndex(
          { workspaceId: 1, applicationId: 1, key: 1 },
          { unique: true },
        ),
        deployments.createIndex({
          workspaceId: 1,
          applicationId: 1,
          componentId: 1,
          status: 1,
          deployedAt: -1,
          id: 1,
        }),
        deployments.createIndex({
          workspaceId: 1,
          applicationId: 1,
          "source.repositoryId": 1,
        }),
        deployments.createIndex({
          workspaceId: 1,
          applicationId: 1,
          deployedAt: -1,
          id: 1,
        }),
        runtimes.createIndex({ id: 1 }, { unique: true }),
        runtimes.createIndex(
          { workspaceId: 1, applicationId: 1, deploymentId: 1, key: 1 },
          { unique: true },
        ),
        runtimes.createIndex({
          workspaceId: 1,
          applicationId: 1,
          deploymentId: 1,
          status: 1,
          name: 1,
          id: 1,
        }),
        runtimes.createIndex({ workspaceId: 1, serverId: 1, status: 1 }),
        runtimes.createIndex({
          workspaceId: 1,
          applicationId: 1,
          name: 1,
          id: 1,
        }),
      ]);
      return { db, components, repositories, servers, deployments, runtimes };
    })().catch((error) => {
      collectionsPromise = undefined;
      throw error;
    });
  }
  return collectionsPromise;
}

export async function requireOperationalWorkspace(
  workspaceId,
  { active = false } = {},
) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    throw createCatalogError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (active && workspace.status !== "active") {
    throw createCatalogError(
      409,
      "WORKSPACE_ARCHIVED",
      "Workspace is archived",
    );
  }
  return workspace;
}

export async function requireOperationalApplication(
  applicationId,
  { active = false, workspaceId } = {},
) {
  const application = await getApplication(applicationId, { workspaceId });
  if (!application) {
    throw createCatalogError(
      404,
      "APPLICATION_NOT_FOUND",
      "Application not found",
    );
  }
  await requireOperationalWorkspace(application.workspaceId, { active });
  if (active && application.status !== "active") {
    throw createCatalogError(
      409,
      "APPLICATION_ARCHIVED",
      "Application is archived",
    );
  }
  return application;
}

export function duplicateKeyError(error, code, message) {
  if (error?.code !== 11000) throw error;
  throw createCatalogError(409, code, message);
}

export function createBaseDocument({
  key,
  workspaceId,
  applicationId,
  actor,
  now = new Date(),
}) {
  return {
    key,
    workspaceId: String(workspaceId),
    ...(applicationId ? { applicationId: String(applicationId) } : {}),
    status: "active",
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
}

export function archiveFields(actor, now = new Date()) {
  return {
    status: "archived",
    archivedAt: now,
    archivedBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
}
