import type { SecretContent, SecretDocument } from "../../types/secrets.js";
import type { AuthorizationScope } from "../../types/http.js";
import type { Actor } from "../../types/http.js";
import { getCollections } from "./storage.js";
import { assertApplication } from "./context.js";
import { normalizeSecretPayload, publicSecret } from "./normalization.js";
import { duplicateSecretError, secretError } from "./support.js";
import { accessFilter } from "./filters.js";
import { randomUUID } from "node:crypto";

export async function createSecretDocument(
  payload: Record<string, unknown>,
  {
    actor,
    version,
    provider,
    locator,
    content,
  }: {
    actor: Partial<Actor>;
    version: number;
    provider: string;
    locator: string;
    content: SecretContent;
  },
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
    provisioningStatus: "ready",
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

export async function createPendingSecretDocument(
  payload: Record<string, unknown>,
  actor: Partial<Actor>,
) {
  const { secrets } = await getCollections();
  const workspaceId = String(actor.workspaceId);
  const applicationId = payload.applicationId
    ? String(payload.applicationId)
    : null;
  await assertApplication(applicationId, workspaceId);
  const metadata = normalizeSecretPayload(payload);
  const contentKind = String(payload.contentKind || "").trim();
  if (!["text", "file"].includes(contentKind)) {
    throw secretError(
      422,
      "INVALID_SECRET_CONTENT_KIND",
      "contentKind must be text or file",
    );
  }
  const now = new Date();
  const document = {
    id: String(payload.id || randomUUID()),
    workspaceId,
    applicationId,
    collectionId: String(payload.collectionId || ""),
    ...metadata,
    provider: null,
    contentKind,
    status: "active",
    provisioningStatus: "pending",
    currentVersion: 0,
    versions: [],
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
  current: SecretDocument,
  payload: Record<string, unknown>,
  actor: Partial<Actor>,
  authorizationScope: AuthorizationScope,
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

export async function archiveSecretDocument(
  current: SecretDocument,
  actor: Partial<Actor>,
  authorizationScope: AuthorizationScope,
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

export async function restoreSecretDocument(
  current: SecretDocument,
  actor: Partial<Actor>,
  authorizationScope: AuthorizationScope,
) {
  if (current.status !== "archived") return publicSecret(current);
  await assertApplication(current.applicationId, current.workspaceId);
  const { secrets } = await getCollections();
  const document = await secrets.findOneAndUpdate(
    {
      id: current.id,
      ...accessFilter(authorizationScope),
      status: "archived",
    },
    {
      $set: {
        status: "active",
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

export async function deleteSecretDocument(
  current: SecretDocument,
  authorizationScope: AuthorizationScope,
) {
  if (current.status !== "archived") {
    throw secretError(
      409,
      "SECRET_NOT_ARCHIVED",
      "Only archived secrets can be permanently deleted",
    );
  }
  const { secrets } = await getCollections();
  const result = await secrets.deleteOne({
    id: current.id,
    ...accessFilter(authorizationScope),
    status: "archived",
  });
  if (!result.deletedCount) {
    throw secretError(409, "SECRET_DELETE_CONFLICT", "Secret was not deleted");
  }
  return publicSecret(current);
}

export async function moveSecretDocumentToCollection(
  current: SecretDocument,
  collectionId: string,
  actor: Partial<Actor>,
  authorizationScope: AuthorizationScope,
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
        collectionId: String(collectionId || ""),
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
