import { requireWorkspace, getWorkspace } from "../workspaces/queries.js";
import { getCollections } from "../storage.js";
import {
  normalizeApplicationInput,
  applicationDeletionDependencies,
} from "./normalization.js";
import {
  actorId,
  duplicateApplicationError,
  normalizeDocument,
  createHttpError,
} from "../support.js";
import { getApplication } from "./queries.js";
import { randomUUID } from "node:crypto";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { assertResourceCollection } from "../../resourceCollections/queries.js";

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
