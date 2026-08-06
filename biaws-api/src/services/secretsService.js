import { randomUUID } from "node:crypto";

import { actorPermissionScope } from "../auth/authorizationMiddleware.js";
import {
  addSecretVersion,
  archiveSecretDocument,
  createPendingSecretDocument,
  createSecretDocument,
  currentSecretVersion,
  getSecretDocument,
  listSecrets,
  moveSecretDocumentToCollection,
  normalizeSecretPayload,
  publicSecret,
  updateSecretDocument,
} from "../repositories/secretsRepository.js";
import { assertResourceCollection } from "../repositories/resourceCollectionsRepository.js";
import { getSecretProvider } from "../secrets/secretProvider.js";
import { normalizeUploadFilename } from "./attachmentService.js";

function secretError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertAllowedFields(payload, allowedFields) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw secretError(422, "INVALID_SECRET", "request body must be an object");
  }
  const unknown = Object.keys(payload).filter(
    (field) => !allowedFields.has(field),
  );
  if (unknown.length) {
    throw secretError(
      422,
      "INVALID_SECRET",
      `unknown secret fields: ${unknown.join(", ")}`,
    );
  }
}

function authorizationScope(actor, permission) {
  const scope = actorPermissionScope(actor, permission);
  return {
    workspaceId: actor.workspaceId,
    workspace: scope?.workspace === true,
    applicationIds: scope?.workspace ? [] : scope?.applicationIds || [],
  };
}

function assertScope(actor, permission, applicationId) {
  const scope = authorizationScope(actor, permission);
  const allowed = applicationId
    ? scope.workspace || scope.applicationIds.includes(String(applicationId))
    : scope.workspace;
  if (!allowed) {
    throw secretError(404, "SECRET_NOT_FOUND", "Secret not found");
  }
  return scope;
}

async function requiredSecret(secretId, actor, permission) {
  const scope = authorizationScope(actor, permission);
  const document = await getSecretDocument(secretId, scope);
  if (!document) {
    throw secretError(404, "SECRET_NOT_FOUND", "Secret not found");
  }
  return { document, scope };
}

function providerContext(document, version) {
  return {
    workspaceId: document.workspaceId,
    secretId: document.id,
    version,
  };
}

function requireSession(actor) {
  if (actor.authenticationMethod !== "session") {
    throw secretError(
      403,
      "SECRET_REVEAL_REQUIRES_SESSION",
      "Secret contents can only be retrieved from an authenticated user session",
    );
  }
}

export function normalizeSecretFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw secretError(
      422,
      "INVALID_SECRET_FILE",
      "multipart field 'file' must contain a non-empty file",
    );
  }
  const decodedName = normalizeUploadFilename(file.originalname || "");
  const fileName = decodedName.replaceAll("\\", "/").split("/").at(-1)?.trim();
  if (
    !fileName ||
    fileName.length > 255 ||
    /[\u0000-\u001f\u007f]/u.test(fileName)
  ) {
    throw secretError(
      422,
      "INVALID_SECRET_FILE",
      "file name must contain between 1 and 255 characters",
    );
  }
  const mediaType = String(file.mimetype || "application/octet-stream").trim();
  if (!mediaType || mediaType.length > 200 || /[\r\n]/u.test(mediaType)) {
    throw secretError(422, "INVALID_SECRET_FILE", "file media type is invalid");
  }
  return {
    kind: "file",
    fileName,
    mediaType,
    size: file.buffer.length,
  };
}

export async function listAccessibleSecrets(query = {}, actor) {
  if (query.applicationId) {
    assertScope(actor, "secrets.metadata.read", query.applicationId);
  }
  return listSecrets({
    ...query,
    authorizationScope: authorizationScope(actor, "secrets.metadata.read"),
  });
}

export async function getAccessibleSecret(secretId, actor) {
  const { document } = await requiredSecret(
    secretId,
    actor,
    "secrets.metadata.read",
  );
  return publicSecret(document);
}

export async function createSecret(payload, actor) {
  assertAllowedFields(
    payload,
    new Set([
      "name",
      "identifier",
      "description",
      "type",
      "environment",
      "applicationId",
      "value",
    ]),
  );
  if (!Object.hasOwn(payload || {}, "value")) {
    throw secretError(422, "INVALID_SECRET_VALUE", "value is required");
  }
  assertScope(actor, "secrets.create", payload.applicationId || null);
  assertScope(actor, "secrets.value.write", payload.applicationId || null);
  normalizeSecretPayload(payload);
  const id = randomUUID();
  const version = 1;
  const provider = getSecretProvider();
  const stored = await provider.putValue(
    { workspaceId: actor.workspaceId, secretId: id, version },
    payload.value,
  );
  const content = {
    kind: "text",
    size: Buffer.byteLength(payload.value, "utf8"),
  };
  try {
    return await createSecretDocument(
      { ...payload, id },
      {
        actor,
        version,
        provider: "local",
        locator: stored.locator,
        content,
      },
    );
  } catch (error) {
    await provider.deleteValue(stored.locator).catch(() => {});
    throw error;
  }
}

export async function registerSecretMetadata(payload, actor) {
  assertAllowedFields(
    payload,
    new Set([
      "name",
      "identifier",
      "description",
      "type",
      "environment",
      "applicationId",
      "collectionId",
      "contentKind",
    ]),
  );
  assertScope(actor, "secrets.metadata.create", payload.applicationId || null);
  normalizeSecretPayload(payload);
  if (!["text", "file"].includes(String(payload.contentKind || "").trim())) {
    throw secretError(
      422,
      "INVALID_SECRET_CONTENT_KIND",
      "contentKind must be text or file",
    );
  }
  const collectionId = await assertResourceCollection(
    "secrets",
    payload.collectionId,
    actor.workspaceId,
  );
  return createPendingSecretDocument({ ...payload, collectionId }, actor);
}

export async function createFileSecret(payload, file, actor) {
  assertAllowedFields(
    payload,
    new Set([
      "name",
      "identifier",
      "description",
      "type",
      "environment",
      "applicationId",
    ]),
  );
  assertScope(actor, "secrets.create", payload.applicationId || null);
  assertScope(actor, "secrets.value.write", payload.applicationId || null);
  normalizeSecretPayload(payload);
  const content = normalizeSecretFile(file);
  const id = randomUUID();
  const version = 1;
  const provider = getSecretProvider();
  const stored = await provider.putContent(
    { workspaceId: actor.workspaceId, secretId: id, version },
    file.buffer,
  );
  try {
    return await createSecretDocument(
      { ...payload, applicationId: payload.applicationId || null, id },
      {
        actor,
        version,
        provider: "local",
        locator: stored.locator,
        content,
      },
    );
  } catch (error) {
    await provider.deleteValue(stored.locator).catch(() => {});
    throw error;
  }
}

export async function updateSecret(secretId, payload, actor) {
  assertAllowedFields(
    payload,
    new Set(["name", "description", "type", "environment", "applicationId"]),
  );
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.update",
  );
  assertScope(actor, "secrets.update", document.applicationId);
  const targetApplicationId = Object.hasOwn(payload, "applicationId")
    ? payload.applicationId || null
    : document.applicationId;
  assertScope(actor, "secrets.update", targetApplicationId);
  return updateSecretDocument(document, payload, actor, scope);
}

export async function moveSecretToCollection(secretId, collectionId, actor) {
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.update",
  );
  const normalizedCollectionId = await assertResourceCollection(
    "secrets",
    collectionId,
    document.workspaceId,
  );
  return moveSecretDocumentToCollection(
    document,
    normalizedCollectionId,
    actor,
    scope,
  );
}

export async function writeSecretValue(secretId, value, actor) {
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.value.write",
  );
  if (document.status !== "active") {
    throw secretError(409, "SECRET_NOT_ACTIVE", "Secret is not active");
  }
  if ((document.contentKind || "text") !== "text") {
    throw secretError(
      409,
      "SECRET_CONTENT_KIND_MISMATCH",
      "File secrets require a file version",
    );
  }
  const version = (Number(document.currentVersion) || 0) + 1;
  const provider = getSecretProvider();
  const stored = await provider.putValue(
    providerContext(document, version),
    value,
  );
  try {
    return await addSecretVersion(
      document,
      {
        locator: stored.locator,
        actor,
        content: {
          kind: "text",
          size: Buffer.byteLength(value, "utf8"),
        },
      },
      scope,
    );
  } catch (error) {
    await provider.deleteValue(stored.locator).catch(() => {});
    throw error;
  }
}

export async function writeSecretFile(secretId, file, actor) {
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.value.write",
  );
  if (document.status !== "active") {
    throw secretError(409, "SECRET_NOT_ACTIVE", "Secret is not active");
  }
  if ((document.contentKind || "text") !== "file") {
    throw secretError(
      409,
      "SECRET_CONTENT_KIND_MISMATCH",
      "Text secrets require a text value version",
    );
  }
  const content = normalizeSecretFile(file);
  const version = (Number(document.currentVersion) || 0) + 1;
  const provider = getSecretProvider();
  const stored = await provider.putContent(
    providerContext(document, version),
    file.buffer,
  );
  try {
    return await addSecretVersion(
      document,
      { locator: stored.locator, actor, content },
      scope,
    );
  } catch (error) {
    await provider.deleteValue(stored.locator).catch(() => {});
    throw error;
  }
}

export async function revealSecret(secretId, actor) {
  requireSession(actor);
  const { document } = await requiredSecret(
    secretId,
    actor,
    "secrets.value.reveal",
  );
  if (document.status !== "active") {
    throw secretError(409, "SECRET_NOT_ACTIVE", "Secret is not active");
  }
  if (document.provisioningStatus === "pending") {
    throw secretError(
      409,
      "SECRET_VALUE_PENDING",
      "Secret content has not been provisioned yet",
    );
  }
  if ((document.contentKind || "text") !== "text") {
    throw secretError(
      409,
      "SECRET_CONTENT_KIND_MISMATCH",
      "File secrets must be downloaded",
    );
  }
  const version = currentSecretVersion(document);
  if (!version) {
    throw secretError(
      500,
      "SECRET_VERSION_MISSING",
      "The current secret version is unavailable",
    );
  }
  return {
    value: await getSecretProvider().getValue(
      providerContext(document, version.version),
      version.locator,
    ),
    version: version.version,
    secret: publicSecret(document),
  };
}

export async function downloadSecretFile(secretId, actor) {
  requireSession(actor);
  const { document } = await requiredSecret(
    secretId,
    actor,
    "secrets.value.reveal",
  );
  if (document.status !== "active") {
    throw secretError(409, "SECRET_NOT_ACTIVE", "Secret is not active");
  }
  if (document.provisioningStatus === "pending") {
    throw secretError(
      409,
      "SECRET_VALUE_PENDING",
      "Secret content has not been provisioned yet",
    );
  }
  if ((document.contentKind || "text") !== "file") {
    throw secretError(
      409,
      "SECRET_CONTENT_KIND_MISMATCH",
      "Text secrets must be revealed",
    );
  }
  const version = currentSecretVersion(document);
  if (!version) {
    throw secretError(
      500,
      "SECRET_VERSION_MISSING",
      "The current secret version is unavailable",
    );
  }
  return {
    content: await getSecretProvider().getContent(
      providerContext(document, version.version),
      version.locator,
    ),
    fileName: version.fileName || "secret-file",
    mediaType: version.mediaType || "application/octet-stream",
    version: version.version,
    secret: publicSecret(document),
  };
}

export async function archiveSecret(secretId, actor) {
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.archive",
  );
  return archiveSecretDocument(document, actor, scope);
}
