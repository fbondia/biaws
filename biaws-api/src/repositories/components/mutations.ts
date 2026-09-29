import type { Actor } from "../../types/http.js";
import { normalizeComponentInput } from "./normalization.js";
import { validateRelationships } from "./context.js";
import { getComponent } from "./queries.js";
import { randomUUID } from "node:crypto";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { actorId, archiveFields, createBaseDocument } from "../shared/topology/lifecycle.js";
import { createCatalogError, duplicateKeyError } from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function createComponent(
  applicationId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const { components } = await getTopologyCollections();
  const normalized = normalizeComponentInput(payload);
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
  await validateRelationships(application, document);
  try {
    await components.insertOne(document);
  } catch (error) {
    duplicateKeyError(error, "COMPONENT_KEY_CONFLICT", "A component with this key already exists in the application");
  }
  return normalizeDocument(document);
}

export async function updateComponent(
  componentId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status !== "active") {
    throw createCatalogError(409, "COMPONENT_ARCHIVED", "Component is archived");
  }
  const application = await requireOperationalApplication(current.applicationId, {
    active: true,
    workspaceId: current.workspaceId,
  });
  const normalized = normalizeComponentInput(payload, current);
  const candidate = { ...current, ...normalized };
  await validateRelationships(application, candidate);
  const { components } = await getTopologyCollections();
  let result;
  try {
    result = await components.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        applicationId: current.applicationId,
        status: "active",
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
    duplicateKeyError(error, "COMPONENT_KEY_CONFLICT", "A component with this key already exists in the application");
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "COMPONENT_CONCURRENT_UPDATE",
      "Component changed concurrently; reload and try again",
    );
  }
  return getComponent(current.id);
}

export async function archiveComponent(componentId: string | string[], actor: Partial<Actor> = {}) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status === "archived") return current;
  const { components, deployments } = await getTopologyCollections();
  const [dependentComponents, activeDeployments] = await Promise.all([
    components.countDocuments({
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: "active",
      "dependencies.componentId": current.id,
    }),
    deployments.countDocuments({
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      componentId: current.id,
      status: { $ne: "archived" },
    }),
  ]);
  if (dependentComponents || activeDeployments) {
    throw createCatalogError(
      409,
      "COMPONENT_IN_USE",
      "Archive dependent components and deployments before archiving the component",
    );
  }
  await components.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: "active",
    },
    { $set: archiveFields(actor) },
  );
  return getComponent(current.id);
}

export async function restoreComponent(componentId: string | string[], actor: Partial<Actor> = {}) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status !== "archived") return current;
  await requireOperationalApplication(current.applicationId, {
    workspaceId: current.workspaceId,
    active: true,
  });
  const { components } = await getTopologyCollections();
  await components.updateOne(
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
  return getComponent(current.id);
}

export async function deleteComponent(componentId: string | string[]) {
  const current = await getComponent(componentId);
  if (!current) {
    throw createCatalogError(404, "COMPONENT_NOT_FOUND", "Component not found");
  }
  if (current.status !== "archived") {
    throw createCatalogError(409, "COMPONENT_NOT_ARCHIVED", "Only archived components can be permanently deleted");
  }
  const { components, deployments, db } = await getTopologyCollections();
  const scope = {
    workspaceId: current.workspaceId,
    applicationId: current.applicationId,
  };
  const counts = await Promise.all([
    components.countDocuments({ ...scope, "dependencies.componentId": current.id }, { limit: 1 }),
    deployments.countDocuments({ ...scope, componentId: current.id }, { limit: 1 }),
    db
      .collection(COLLECTION_NAMES.DOCUMENTS)
      .countDocuments({ ...scope, affectedComponentIds: current.id }, { limit: 1 }),
    db.collection(COLLECTION_NAMES.ISSUES).countDocuments({ ...scope, affectedComponentIds: current.id }, { limit: 1 }),
    db
      .collection(COLLECTION_NAMES.REQUESTS)
      .countDocuments({ ...scope, affectedComponentIds: current.id }, { limit: 1 }),
  ]);
  if (counts.some(Boolean)) {
    throw createCatalogError(409, "COMPONENT_HAS_DEPENDENCIES", "Remova as dependências antes de excluir o componente");
  }
  const result = await components.deleteOne({
    id: current.id,
    ...scope,
    status: "archived",
  });
  if (!result.deletedCount) throw createCatalogError(409, "COMPONENT_DELETE_CONFLICT", "Component was not deleted");
  return current;
}
