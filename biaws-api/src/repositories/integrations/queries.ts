import type { RepositoryQuery } from "../../types/http.js";
import type { IntegrationDocument } from "../../types/topology.js";
import type { WithId } from "mongodb";
import { getCollection } from "./storage.js";
import { STATUSES } from "./constants.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import {
  buildScopedListFilter,
  pagination,
} from "../shared/topology/filters.js";
import { createCatalogError } from "../shared/topology/errors.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

function publicIntegration(
  document: WithId<IntegrationDocument>,
): IntegrationDocument {
  return normalizeDocument(document) as IntegrationDocument;
}

export async function listIntegrations(
  applicationId: string | string[],
  query: RepositoryQuery = {},
) {
  const application = await requireOperationalApplication(applicationId);
  const collection = await getCollection();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: STATUSES,
    query,
  });
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_INTEGRATIONS,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(publicIntegration),
  };
}

export async function getIntegration(
  integrationId: string | string[],
  {
    applicationId,
    workspaceId,
  }: { applicationId?: string; workspaceId?: string } = {},
) {
  const collection = await getCollection();
  const filter: Record<string, string> = { id: String(integrationId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const document = await collection.findOne(filter);
  if (!document) return null;
  const integration = publicIntegration(document);
  await requireOperationalApplication(integration.applicationId, {
    workspaceId: integration.workspaceId,
  });
  return integration;
}

export async function assertNoActiveApplicationIntegrations(
  workspaceId: string,
  applicationId: string,
) {
  const count = await (
    await getCollection()
  ).countDocuments({
    workspaceId: String(workspaceId),
    status: "active",
    $or: [
      { applicationId: String(applicationId) },
      { targetApplicationId: String(applicationId) },
    ],
  });
  if (count) {
    throw createCatalogError(
      409,
      "APPLICATION_INTEGRATION_IN_USE",
      "Archive integrations involving the application before archiving it",
    );
  }
}
