import { normalizeIntegrationInput } from "./normalization.js";
import { validateTarget } from "./context.js";
import { getCollection } from "./storage.js";
import { getIntegration } from "./queries.js";
import { randomUUID } from "node:crypto";
import {
  actorId,
  archiveFields,
  createBaseDocument,
} from "../shared/topology/lifecycle.js";
import {
  createCatalogError,
  duplicateKeyError,
} from "../shared/topology/errors.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function createIntegration(
  applicationId,
  payload = {},
  actor = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const normalized = normalizeIntegrationInput(payload);
  await validateTarget(application, normalized.targetApplicationId);
  const document = {
    id: randomUUID(),
    ...createBaseDocument({
      key: normalized.key,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      actor,
    }),
    ...normalized,
  };
  try {
    await (await getCollection()).insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "INTEGRATION_CONFLICT",
      "An integration with this key or target already exists in the application",
    );
  }
  return normalizeDocument(document);
}

export async function updateIntegration(
  integrationId,
  payload = {},
  actor = {},
) {
  const current = await getIntegration(integrationId);
  if (!current) {
    throw createCatalogError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration not found",
    );
  }
  if (current.status !== "active") {
    throw createCatalogError(
      409,
      "INTEGRATION_ARCHIVED",
      "Integration is archived",
    );
  }
  const application = await requireOperationalApplication(
    current.applicationId,
    { active: true, workspaceId: current.workspaceId },
  );
  const normalized = normalizeIntegrationInput(payload, current);
  await validateTarget(application, normalized.targetApplicationId);
  try {
    await (
      await getCollection()
    ).updateOne(
      { id: current.id, status: "active" },
      {
        $set: {
          ...normalized,
          updatedAt: new Date(),
          updatedBy: actorId(actor),
        },
      },
    );
  } catch (error) {
    duplicateKeyError(
      error,
      "INTEGRATION_CONFLICT",
      "An integration with this key or target already exists in the application",
    );
  }
  return getIntegration(current.id);
}

export async function archiveIntegration(integrationId, actor = {}) {
  const current = await getIntegration(integrationId);
  if (!current) {
    throw createCatalogError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration not found",
    );
  }
  if (current.status === "archived") return current;
  await (
    await getCollection()
  ).updateOne(
    { id: current.id, status: "active" },
    { $set: archiveFields(actor) },
  );
  return getIntegration(current.id);
}

export async function restoreIntegration(integrationId, actor = {}) {
  const current = await getIntegration(integrationId);
  if (!current)
    throw createCatalogError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration not found",
    );
  if (current.status !== "archived") return current;
  await requireOperationalApplication(current.applicationId, {
    workspaceId: current.workspaceId,
    active: true,
  });
  await requireOperationalApplication(current.targetApplicationId, {
    workspaceId: current.workspaceId,
    active: true,
  });
  const collection = await getCollection();
  await collection.updateOne(
    { id: current.id, workspaceId: current.workspaceId, status: "archived" },
    {
      $set: {
        status: "active",
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
      $unset: { archivedAt: "", archivedBy: "" },
    },
  );
  return getIntegration(current.id);
}

export async function deleteIntegration(integrationId) {
  const current = await getIntegration(integrationId);
  if (!current)
    throw createCatalogError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration not found",
    );
  if (current.status !== "archived")
    throw createCatalogError(
      409,
      "INTEGRATION_NOT_ARCHIVED",
      "Only archived integrations can be permanently deleted",
    );
  const result = await (
    await getCollection()
  ).deleteOne({
    id: current.id,
    workspaceId: current.workspaceId,
    status: "archived",
  });
  if (!result.deletedCount)
    throw createCatalogError(
      409,
      "INTEGRATION_DELETE_CONFLICT",
      "Integration was not deleted",
    );
  return current;
}
