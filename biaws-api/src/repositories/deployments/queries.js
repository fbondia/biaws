import {
  DEPLOYMENT_ENVIRONMENTS,
  DEPLOYMENT_STATUSES,
} from "../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import {
  buildScopedListFilter,
  pagination,
} from "../shared/topology/filters.js";
import { createCatalogError } from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import {
  normalizeDocument,
  normalizeEnum,
} from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";
import { assertNoActiveApplicationIntegrations } from "../integrations/queries.js";

export async function listDeployments(applicationId, query = {}) {
  const application = await requireOperationalApplication(applicationId);
  const { deployments, runtimes } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: DEPLOYMENT_STATUSES,
    query,
    searchFields: ["key", "name", "environment", "version", "source.revision"],
  });
  if (query.componentId) filter.componentId = String(query.componentId);
  if (query.repositoryId) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { repositoryId: String(query.repositoryId) },
          { "source.repositoryId": String(query.repositoryId) },
        ],
      },
    ];
  }
  if (query.environment) {
    filter.environment = normalizeEnum(
      query.environment,
      "environment",
      DEPLOYMENT_ENVIRONMENTS,
    );
  }
  if (query.serverId) {
    const deploymentIds = await runtimes.distinct("deploymentId", {
      workspaceId: application.workspaceId,
      applicationId: application.id,
      serverId: String(query.serverId),
      ...(String(query.includeArchived || "").toLowerCase() === "true"
        ? {}
        : { status: { $ne: "archived" } }),
    });
    filter.id = { $in: deploymentIds };
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    deployments
      .find(filter)
      .sort({ deployedAt: -1, name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    deployments.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_DEPLOYMENTS,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function getDeployment(
  deploymentId,
  { applicationId, workspaceId } = {},
) {
  const { deployments } = await getTopologyCollections();
  const filter = { id: String(deploymentId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const deployment = normalizeDocument(await deployments.findOne(filter));
  if (!deployment) return null;
  await requireOperationalApplication(deployment.applicationId, {
    workspaceId: deployment.workspaceId,
  });
  return deployment;
}

export async function assertApplicationCanArchive(applicationId) {
  const application = await requireOperationalApplication(applicationId);
  await assertNoActiveApplicationIntegrations(
    application.workspaceId,
    application.id,
  );
  const { components, repositories, deployments, runtimes } =
    await getTopologyCollections();
  const scope = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  const counts = await Promise.all([
    components.countDocuments({ ...scope, status: "active" }),
    repositories.countDocuments({ ...scope, status: "active" }),
    deployments.countDocuments({ ...scope, status: { $ne: "archived" } }),
    runtimes.countDocuments({ ...scope, status: { $ne: "archived" } }),
  ]);
  if (counts.some(Boolean)) {
    throw createCatalogError(
      409,
      "APPLICATION_TOPOLOGY_IN_USE",
      "Archive all application topology resources before archiving the application",
    );
  }
}
