import { randomUUID } from "node:crypto";

import { actorPermissionScope } from "../auth/authorizationMiddleware.js";
import {
  addSecretVersion,
  archiveSecretDocument,
  createSecretDocument,
  currentSecretVersion,
  getSecretDocument,
  listSecrets,
  normalizeSecretPayload,
  publicSecret,
  updateSecretDocument,
} from "../repositories/secretsRepository.js";
import { getSecretProvider } from "../secrets/secretProvider.js";

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
  try {
    return await createSecretDocument(
      { ...payload, id },
      {
        actor,
        version,
        provider: "local",
        locator: stored.locator,
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
    new Set(["name", "description", "type", "environment"]),
  );
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.update",
  );
  assertScope(actor, "secrets.update", document.applicationId);
  return updateSecretDocument(document, payload, actor, scope);
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
  const version = document.currentVersion + 1;
  const provider = getSecretProvider();
  const stored = await provider.putValue(
    providerContext(document, version),
    value,
  );
  try {
    return await addSecretVersion(
      document,
      { locator: stored.locator, actor },
      scope,
    );
  } catch (error) {
    await provider.deleteValue(stored.locator).catch(() => {});
    throw error;
  }
}

export async function revealSecret(secretId, actor) {
  if (actor.authenticationMethod !== "session") {
    throw secretError(
      403,
      "SECRET_REVEAL_REQUIRES_SESSION",
      "Secret values can only be revealed from an authenticated user session",
    );
  }
  const { document } = await requiredSecret(
    secretId,
    actor,
    "secrets.value.reveal",
  );
  if (document.status !== "active") {
    throw secretError(409, "SECRET_NOT_ACTIVE", "Secret is not active");
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

export async function archiveSecret(secretId, actor) {
  const { document, scope } = await requiredSecret(
    secretId,
    actor,
    "secrets.archive",
  );
  return archiveSecretDocument(document, actor, scope);
}
