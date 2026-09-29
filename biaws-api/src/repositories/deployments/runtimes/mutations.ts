import type { Actor } from "../../../types/http.js";
import { getDeployment } from "../queries.js";
import { normalizeRuntimeInput } from "./normalization.js";
import { validateRuntimeServer, validateRuntimeDocuments } from "./context.js";
import { getRuntime } from "./queries.js";
import { randomUUID } from "node:crypto";
import { RUNTIME_STATUSES } from "../../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import {
  actorId,
  archiveFields,
  createBaseDocument,
} from "../../shared/topology/lifecycle.js";
import {
  createCatalogError,
  duplicateKeyError,
} from "../../shared/topology/errors.js";
import { getTopologyCollections } from "../../shared/topology/storage.js";
import { normalizeDocument } from "../../shared/topology/normalization.js";
import { requireOperationalApplication } from "../../shared/topology/context.js";

export async function createRuntime(
  deploymentId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (deployment.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  await requireOperationalApplication(deployment.applicationId, {
    active: true,
    workspaceId: deployment.workspaceId,
  });
  const normalized = normalizeRuntimeInput(payload, null, actor);
  await validateRuntimeServer(deployment, normalized);
  await validateRuntimeDocuments(deployment, normalized);
  const document = {
    id: randomUUID(),
    ...createBaseDocument({
      key: normalized.key,
      workspaceId: deployment.workspaceId,
      applicationId: deployment.applicationId,
      actor,
    }),
    deploymentId: deployment.id,
    componentId: deployment.componentId,
    ...normalized,
  };
  const { runtimes } = await getTopologyCollections();
  try {
    await runtimes.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "RUNTIME_KEY_CONFLICT",
      "A runtime with this key already exists in the deployment",
    );
  }
  return normalizeDocument(document);
}

export async function updateRuntime(
  runtimeId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const current = await getRuntime(runtimeId);
  if (!current) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  if (current.status === "archived") {
    throw createCatalogError(409, "RUNTIME_ARCHIVED", "Runtime is archived");
  }
  const deployment = await getDeployment(current.deploymentId, {
    applicationId: current.applicationId,
  });
  if (!deployment || deployment.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  await requireOperationalApplication(current.applicationId, {
    active: true,
    workspaceId: current.workspaceId,
  });
  const normalized = normalizeRuntimeInput(payload, current, actor);
  await validateRuntimeServer(deployment, normalized);
  if (
    payload.documentLinks !== undefined &&
    JSON.stringify(normalized.documentLinks) !==
      JSON.stringify(current.documentLinks || [])
  ) {
    await validateRuntimeDocuments(deployment, normalized);
  }
  const { runtimes } = await getTopologyCollections();
  let result;
  try {
    result = await runtimes.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        deploymentId: current.deploymentId,
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
      "RUNTIME_KEY_CONFLICT",
      "A runtime with this key already exists in the deployment",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "RUNTIME_CONCURRENT_UPDATE",
      "Runtime changed concurrently; reload and try again",
    );
  }
  return getRuntime(current.id);
}

export async function archiveRuntime(
  runtimeId: string | string[],
  actor: Partial<Actor> = {},
) {
  const current = await getRuntime(runtimeId);
  if (!current) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  if (current.status === "archived") return current;
  const { runtimes } = await getTopologyCollections();
  await runtimes.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      deploymentId: current.deploymentId,
      status: { $ne: "archived" },
    },
    { $set: { ...archiveFields(actor), archivedFromStatus: current.status } },
  );
  return getRuntime(current.id);
}

export async function restoreRuntime(
  runtimeId: string | string[],
  actor: Partial<Actor> = {},
) {
  const current = await getRuntime(runtimeId);
  if (!current)
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  if (current.status !== "archived") return current;
  const deployment = await getDeployment(current.deploymentId);
  if (!deployment || deployment.status === "archived")
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Restore the deployment before restoring the runtime",
    );
  const restoredStatus =
    RUNTIME_STATUSES.includes(current.archivedFromStatus || "") &&
    current.archivedFromStatus !== "archived"
      ? current.archivedFromStatus
      : "stopped";
  const { runtimes } = await getTopologyCollections();
  await runtimes.updateOne(
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
  return getRuntime(current.id);
}

export async function deleteRuntime(runtimeId: string | string[]) {
  const current = await getRuntime(runtimeId);
  if (!current)
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  if (current.status !== "archived")
    throw createCatalogError(
      409,
      "RUNTIME_NOT_ARCHIVED",
      "Only archived runtimes can be permanently deleted",
    );
  const { db, runtimes } = await getTopologyCollections();
  const result = await runtimes.deleteOne({
    id: current.id,
    workspaceId: current.workspaceId,
    status: "archived",
  });
  if (!result.deletedCount)
    throw createCatalogError(
      409,
      "RUNTIME_DELETE_CONFLICT",
      "Runtime was not deleted",
    );
  await db
    .collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS)
    .deleteMany({ workspaceId: current.workspaceId, runtimeId: current.id });
  return current;
}
