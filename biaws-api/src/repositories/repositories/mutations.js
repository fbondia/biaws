import { normalizeRepositoryInput } from "./normalization.js";
import { getRepository } from "./queries.js";
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
import { getTopologyCollections } from "../shared/topology/storage.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function createRepository(
  applicationId,
  payload = {},
  actor = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const normalized = normalizeRepositoryInput(payload);
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
  const { repositories } = await getTopologyCollections();
  try {
    await repositories.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "REPOSITORY_KEY_CONFLICT",
      "A repository with this key already exists in the application",
    );
  }
  return normalizeDocument(document);
}

export async function updateRepository(repositoryId, payload = {}, actor = {}) {
  const current = await getRepository(repositoryId);
  if (!current) {
    throw createCatalogError(
      404,
      "REPOSITORY_NOT_FOUND",
      "Repository not found",
    );
  }
  if (current.status !== "active") {
    throw createCatalogError(
      409,
      "REPOSITORY_ARCHIVED",
      "Repository is archived",
    );
  }
  await requireOperationalApplication(current.applicationId, {
    active: true,
    workspaceId: current.workspaceId,
  });
  const normalized = normalizeRepositoryInput(payload, current);
  const { repositories } = await getTopologyCollections();
  let result;
  try {
    result = await repositories.updateOne(
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
    duplicateKeyError(
      error,
      "REPOSITORY_KEY_CONFLICT",
      "A repository with this key already exists in the application",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "REPOSITORY_CONCURRENT_UPDATE",
      "Repository changed concurrently; reload and try again",
    );
  }
  return getRepository(current.id);
}

export async function archiveRepository(repositoryId, actor = {}) {
  const current = await getRepository(repositoryId);
  if (!current) {
    throw createCatalogError(
      404,
      "REPOSITORY_NOT_FOUND",
      "Repository not found",
    );
  }
  if (current.status === "archived") return current;
  const { components, deployments, repositories } =
    await getTopologyCollections();
  const [linkedComponents, linkedDeployments] = await Promise.all([
    components.countDocuments({
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: "active",
      "repositoryLinks.repositoryId": current.id,
    }),
    deployments.countDocuments({
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: { $ne: "archived" },
      $or: [
        { repositoryId: current.id },
        { "source.repositoryId": current.id },
      ],
    }),
  ]);
  if (linkedComponents || linkedDeployments) {
    throw createCatalogError(
      409,
      "REPOSITORY_IN_USE",
      "Remove active component and deployment references before archiving the repository",
    );
  }
  await repositories.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: "active",
    },
    { $set: archiveFields(actor) },
  );
  return getRepository(current.id);
}

export async function restoreRepository(repositoryId, actor = {}) {
  const current = await getRepository(repositoryId);
  if (!current)
    throw createCatalogError(
      404,
      "REPOSITORY_NOT_FOUND",
      "Repository not found",
    );
  if (current.status !== "archived") return current;
  await requireOperationalApplication(current.applicationId, {
    workspaceId: current.workspaceId,
    active: true,
  });
  const { repositories } = await getTopologyCollections();
  await repositories.updateOne(
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
  return getRepository(current.id);
}

export async function deleteRepository(repositoryId) {
  const current = await getRepository(repositoryId);
  if (!current)
    throw createCatalogError(
      404,
      "REPOSITORY_NOT_FOUND",
      "Repository not found",
    );
  if (current.status !== "archived")
    throw createCatalogError(
      409,
      "REPOSITORY_NOT_ARCHIVED",
      "Only archived repositories can be permanently deleted",
    );
  const { components, deployments, repositories } =
    await getTopologyCollections();
  const scope = {
    workspaceId: current.workspaceId,
    applicationId: current.applicationId,
  };
  const counts = await Promise.all([
    components.countDocuments(
      { ...scope, "repositoryLinks.repositoryId": current.id },
      { limit: 1 },
    ),
    deployments.countDocuments(
      {
        ...scope,
        $or: [
          { repositoryId: current.id },
          { "source.repositoryId": current.id },
        ],
      },
      { limit: 1 },
    ),
  ]);
  if (counts.some(Boolean))
    throw createCatalogError(
      409,
      "REPOSITORY_HAS_DEPENDENCIES",
      "Remova as referências antes de excluir o repositório",
    );
  const result = await repositories.deleteOne({
    id: current.id,
    ...scope,
    status: "archived",
  });
  if (!result.deletedCount)
    throw createCatalogError(
      409,
      "REPOSITORY_DELETE_CONFLICT",
      "Repository was not deleted",
    );
  return current;
}
