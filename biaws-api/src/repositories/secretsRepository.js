import { randomUUID } from "node:crypto";

import { DEPLOYMENT_ENVIRONMENTS } from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

const SECRET_TYPES = new Set([
  "password",
  "api-key",
  "token",
  "private-key",
  "generic",
]);
const SECRET_ENVIRONMENTS = new Set([...DEPLOYMENT_ENVIRONMENTS, ""]);
const SECRET_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])$/u;
let collectionPromise;

function secretError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizedName(value) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeSecretIdentifier(value) {
  const identifier = String(value || "")
    .trim()
    .toLowerCase();
  if (!SECRET_IDENTIFIER_PATTERN.test(identifier)) {
    throw secretError(
      422,
      "INVALID_SECRET_IDENTIFIER",
      "identifier must contain 2 to 100 lowercase letters, numbers, dots, underscores or hyphens, starting and ending with a letter or number",
    );
  }
  return identifier;
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength) {
    throw secretError(
      422,
      "INVALID_SECRET",
      `${field} must contain between 1 and ${maxLength} characters`,
    );
  }
  return normalized;
}

function optionalText(value, field, maxLength) {
  const normalized = String(value || "").trim();
  if (normalized.length > maxLength) {
    throw secretError(
      422,
      "INVALID_SECRET",
      `${field} must contain at most ${maxLength} characters`,
    );
  }
  return normalized;
}

export function normalizeSecretPayload(payload = {}, current = null) {
  const name = requiredText(payload.name ?? current?.name, "name", 100);
  const type = String(payload.type ?? current?.type ?? "generic").trim();
  const environment = String(
    payload.environment ?? current?.environment ?? "",
  ).trim();
  if (!SECRET_TYPES.has(type)) {
    throw secretError(422, "INVALID_SECRET", "type is invalid");
  }
  if (!SECRET_ENVIRONMENTS.has(environment)) {
    throw secretError(422, "INVALID_SECRET", "environment is invalid");
  }
  return {
    identifier: normalizeSecretIdentifier(
      payload.identifier ?? current?.identifier ?? current?.id,
    ),
    name,
    normalizedName: normalizedName(name),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      500,
    ),
    type,
    environment,
  };
}

export function publicSecret(document) {
  if (!document) return null;
  const currentVersion = currentSecretVersion(document);
  const contentKind = document.contentKind || currentVersion?.kind || "text";
  return {
    id: String(document.id),
    workspaceId: String(document.workspaceId),
    applicationId: document.applicationId
      ? String(document.applicationId)
      : null,
    identifier: document.identifier || String(document.id),
    name: document.name,
    description: document.description || "",
    type: document.type,
    environment: document.environment || "",
    provider: document.provider,
    status: document.status,
    currentVersion: document.currentVersion,
    versionCount: document.versions?.length || 0,
    contentKind,
    file:
      contentKind === "file"
        ? {
            name: currentVersion?.fileName || "secret-file",
            mediaType: currentVersion?.mediaType || "application/octet-stream",
            size: Number(currentVersion?.size) || 0,
          }
        : null,
    createdAt: document.createdAt,
    createdBy: document.createdBy,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  };
}

async function getCollections() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const db = await getMongoDatabase();
      const secrets = db.collection(COLLECTION_NAMES.SECRETS);
      await Promise.all([
        secrets.createIndex({ id: 1 }, { unique: true }),
        secrets.createIndex(
          { workspaceId: 1, applicationId: 1, normalizedName: 1 },
          { unique: true },
        ),
        secrets.createIndex(
          { workspaceId: 1, identifier: 1 },
          {
            unique: true,
            partialFilterExpression: { identifier: { $type: "string" } },
          },
        ),
        secrets.createIndex({ workspaceId: 1, status: 1, name: 1, id: 1 }),
      ]);
      return {
        db,
        secrets,
        applications: db.collection(COLLECTION_NAMES.APPLICATIONS),
      };
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

async function assertApplication(applicationId, workspaceId) {
  if (!applicationId) return;
  const { applications } = await getCollections();
  const exists = await applications.countDocuments(
    { id: applicationId, workspaceId, status: "active" },
    { limit: 1 },
  );
  if (!exists) {
    throw secretError(
      422,
      "INVALID_SECRET_APPLICATION",
      "applicationId must reference an active application in the workspace",
    );
  }
}

function duplicateSecretError(error) {
  if (error?.code !== 11000) throw error;
  if (error?.keyPattern?.identifier) {
    throw secretError(
      409,
      "SECRET_IDENTIFIER_CONFLICT",
      "A secret with this identifier already exists in the workspace",
    );
  }
  throw secretError(
    409,
    "SECRET_NAME_CONFLICT",
    "A secret with this name already exists in the selected scope",
  );
}

function accessFilter({ workspaceId, workspace, applicationIds }) {
  const filter = { workspaceId: String(workspaceId) };
  if (workspace !== true) {
    filter.applicationId = {
      $in: [...new Set((applicationIds || []).map(String))],
    };
  }
  return filter;
}

export async function listSecrets(query = {}) {
  const { secrets } = await getCollections();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const status = String(query.status || "active").trim();
  if (!["active", "archived"].includes(status)) {
    throw secretError(422, "INVALID_SECRET_FILTER", "status is invalid");
  }
  const filter = {
    ...accessFilter(query.authorizationScope || {}),
    status,
  };
  if (query.applicationId) {
    filter.applicationId = String(query.applicationId);
  }
  const [documents, total] = await Promise.all([
    secrets
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    secrets.countDocuments(filter),
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    items: documents.map(publicSecret),
  };
}

export async function getSecretDocument(secretId, authorizationScope) {
  const { secrets } = await getCollections();
  return secrets.findOne({
    id: String(secretId),
    ...accessFilter(authorizationScope),
  });
}

export async function createSecretDocument(
  payload,
  { actor, version, provider, locator, content },
) {
  const { secrets } = await getCollections();
  const workspaceId = String(actor.workspaceId);
  const applicationId = payload.applicationId
    ? String(payload.applicationId)
    : null;
  await assertApplication(applicationId, workspaceId);
  const metadata = normalizeSecretPayload(payload);
  const now = new Date();
  const document = {
    id: String(payload.id || randomUUID()),
    workspaceId,
    applicationId,
    ...metadata,
    provider,
    contentKind: content?.kind || "text",
    status: "active",
    currentVersion: version,
    versions: [
      {
        version,
        locator,
        kind: content?.kind || "text",
        ...(content?.kind === "file"
          ? {
              fileName: content.fileName,
              mediaType: content.mediaType,
              size: content.size,
            }
          : { size: content?.size }),
        createdAt: now,
        createdBy: actor.userId,
      },
    ],
    createdAt: now,
    createdBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
  };
  try {
    await secrets.insertOne(document);
  } catch (error) {
    duplicateSecretError(error);
  }
  return publicSecret(document);
}

export async function updateSecretDocument(
  current,
  payload,
  actor,
  authorizationScope,
) {
  const { secrets } = await getCollections();
  const metadata = normalizeSecretPayload(payload, current);
  const applicationId = Object.hasOwn(payload, "applicationId")
    ? payload.applicationId
      ? String(payload.applicationId)
      : null
    : current.applicationId || null;
  await assertApplication(applicationId, current.workspaceId);
  try {
    const document = await secrets.findOneAndUpdate(
      {
        id: current.id,
        ...accessFilter(authorizationScope),
        status: "active",
      },
      {
        $set: {
          ...metadata,
          applicationId,
          updatedAt: new Date(),
          updatedBy: actor.userId,
        },
      },
      { returnDocument: "after" },
    );
    if (!document) {
      throw secretError(404, "SECRET_NOT_FOUND", "Secret not found");
    }
    return publicSecret(document);
  } catch (error) {
    duplicateSecretError(error);
  }
}

export async function addSecretVersion(
  current,
  { locator, actor, content },
  authorizationScope,
) {
  const { secrets } = await getCollections();
  const version = current.currentVersion + 1;
  const now = new Date();
  const document = await secrets.findOneAndUpdate(
    {
      id: current.id,
      ...accessFilter(authorizationScope),
      status: "active",
      currentVersion: current.currentVersion,
    },
    {
      $set: {
        currentVersion: version,
        updatedAt: now,
        updatedBy: actor.userId,
      },
      $push: {
        versions: {
          version,
          locator,
          kind: content?.kind || current.contentKind || "text",
          ...(content?.kind === "file"
            ? {
                fileName: content.fileName,
                mediaType: content.mediaType,
                size: content.size,
              }
            : { size: content?.size }),
          createdAt: now,
          createdBy: actor.userId,
        },
      },
    },
    { returnDocument: "after" },
  );
  if (!document) {
    throw secretError(
      409,
      "SECRET_VERSION_CONFLICT",
      "The secret changed while the new version was being stored",
    );
  }
  return publicSecret(document);
}

export async function archiveSecretDocument(
  current,
  actor,
  authorizationScope,
) {
  const { secrets } = await getCollections();
  const document = await secrets.findOneAndUpdate(
    {
      id: current.id,
      ...accessFilter(authorizationScope),
      status: "active",
    },
    {
      $set: {
        status: "archived",
        updatedAt: new Date(),
        updatedBy: actor.userId,
      },
    },
    { returnDocument: "after" },
  );
  if (!document) {
    throw secretError(404, "SECRET_NOT_FOUND", "Secret not found");
  }
  return publicSecret(document);
}

export function currentSecretVersion(document) {
  return document?.versions?.find(
    ({ version }) => version === document.currentVersion,
  );
}
