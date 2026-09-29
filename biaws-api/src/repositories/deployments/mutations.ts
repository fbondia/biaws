import type { Actor } from "../../types/http.js";
import { normalizeDeploymentInput } from "./normalization.js";
import { validateDeploymentRelationships } from "./context.js";
import { getDeployment } from "./queries.js";
import { randomUUID } from "node:crypto";
import { DEPLOYMENT_STATUSES } from "../../../../shared/index.js";
import {
  actorId,
  archiveFields,
  createBaseDocument,
} from "../shared/topology/lifecycle.js";
import {
  createCatalogError,
  duplicateKeyError,
} from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function createDeployment(
  applicationId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const normalized = normalizeDeploymentInput(payload, null, actor);
  await validateDeploymentRelationships(application, normalized);
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
  const { deployments } = await getTopologyCollections();
  try {
    await deployments.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "DEPLOYMENT_KEY_CONFLICT",
      "A deployment with this key already exists in the application",
    );
  }
  return normalizeDocument(document);
}

export async function updateDeployment(
  deploymentId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const current = await getDeployment(deploymentId);
  if (!current) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (current.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  const application = await requireOperationalApplication(
    current.applicationId,
    {
      active: true,
      workspaceId: current.workspaceId,
    },
  );
  const normalized = normalizeDeploymentInput(payload, current, actor);
  await validateDeploymentRelationships(application, normalized);
  const { deployments } = await getTopologyCollections();
  let result;
  try {
    result = await deployments.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        status: { $ne: "archived" },
      },
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
      "DEPLOYMENT_KEY_CONFLICT",
      "A deployment with this key already exists in the application",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_CONCURRENT_UPDATE",
      "Deployment changed concurrently; reload and try again",
    );
  }
  return getDeployment(current.id);
}

export async function archiveDeployment(
  deploymentId: string | string[],
  actor: Partial<Actor> = {},
) {
  const current = await getDeployment(deploymentId);
  if (!current) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (current.status === "archived") return current;
  const { deployments, runtimes } = await getTopologyCollections();
  const activeRuntimes = await runtimes.countDocuments({
    workspaceId: current.workspaceId,
    applicationId: current.applicationId,
    deploymentId: current.id,
    status: { $ne: "archived" },
  });
  if (activeRuntimes) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_IN_USE",
      "Archive all runtimes before archiving the deployment",
    );
  }
  await deployments.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: { $ne: "archived" },
    },
    { $set: { ...archiveFields(actor), archivedFromStatus: current.status } },
  );
  return getDeployment(current.id);
}

export async function restoreDeployment(
  deploymentId: string | string[],
  actor: Partial<Actor> = {},
) {
  const current = await getDeployment(deploymentId);
  if (!current)
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  if (current.status !== "archived") return current;
  await requireOperationalApplication(current.applicationId, {
    workspaceId: current.workspaceId,
    active: true,
  });
  const restoredStatus =
    DEPLOYMENT_STATUSES.includes(current.archivedFromStatus || "") &&
    current.archivedFromStatus !== "archived"
      ? current.archivedFromStatus
      : "inactive";
  const { deployments } = await getTopologyCollections();
  await deployments.updateOne(
    { id: current.id, workspaceId: current.workspaceId, status: "archived" },
    {
      $set: {
        status: restoredStatus,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
      $unset: { archivedAt: "", archivedBy: "", archivedFromStatus: "" },
    },
  );
  return getDeployment(current.id);
}

export async function deleteDeployment(deploymentId: string | string[]) {
  const current = await getDeployment(deploymentId);
  if (!current)
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  if (current.status !== "archived")
    throw createCatalogError(
      409,
      "DEPLOYMENT_NOT_ARCHIVED",
      "Only archived deployments can be permanently deleted",
    );
  const { deployments, runtimes } = await getTopologyCollections();
  const runtimeCount = await runtimes.countDocuments(
    { workspaceId: current.workspaceId, deploymentId: current.id },
    { limit: 1 },
  );
  if (runtimeCount)
    throw createCatalogError(
      409,
      "DEPLOYMENT_HAS_DEPENDENCIES",
      "Exclua os runtimes antes de excluir o deployment",
    );
  const result = await deployments.deleteOne({
    id: current.id,
    workspaceId: current.workspaceId,
    status: "archived",
  });
  if (!result.deletedCount)
    throw createCatalogError(
      409,
      "DEPLOYMENT_DELETE_CONFLICT",
      "Deployment was not deleted",
    );
  return current;
}
