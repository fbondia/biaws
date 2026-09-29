import type { RepositoryQuery } from "../../types/http.js";
import type {
  RepositoryDocument,
  ComponentDocument,
} from "../../types/topology.js";
import type { Filter } from "mongodb";
import {
  REPOSITORY_PROVIDERS,
  REPOSITORY_STATUSES,
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

export async function listRepositories(
  applicationId: string | string[],
  query: RepositoryQuery = {},
) {
  const application = await requireOperationalApplication(applicationId);
  const { repositories } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: REPOSITORY_STATUSES,
    query,
    searchFields: ["key", "name", "description", "organization", "url"],
  });
  if (query.provider) {
    filter.provider = normalizeEnum(
      query.provider,
      "provider",
      REPOSITORY_PROVIDERS,
    );
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    repositories
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    repositories.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_REPOSITORIES,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(
      (document) => normalizeDocument(document) as RepositoryDocument,
    ),
  };
}

export async function getRepository(
  repositoryId: string | string[],
  {
    applicationId,
    workspaceId,
  }: { applicationId?: string; workspaceId?: string } = {},
) {
  const { repositories } = await getTopologyCollections();
  const filter: Filter<RepositoryDocument> = { id: String(repositoryId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const repository = normalizeDocument(
    await repositories.findOne(filter),
  ) as RepositoryDocument | null;
  if (!repository) return null;
  await requireOperationalApplication(repository.applicationId, {
    workspaceId: repository.workspaceId,
  });
  return repository;
}

export async function listRepositoryComponents(
  repositoryId: string | string[],
  query: RepositoryQuery = {},
) {
  const repository = await getRepository(repositoryId);
  if (!repository) {
    throw createCatalogError(
      404,
      "REPOSITORY_NOT_FOUND",
      "Repository not found",
    );
  }
  const { components } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: repository.workspaceId,
    applicationId: repository.applicationId,
    statuses: ["active", "archived"],
    query,
  });
  filter["repositoryLinks.repositoryId"] = repository.id;
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    components
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    components.countDocuments(filter),
  ]);
  return {
    meta: {
      repositoryId: repository.id,
      workspaceId: repository.workspaceId,
      applicationId: repository.applicationId,
      total,
      page,
      limit,
    },
    items: documents.map(
      (document) => normalizeDocument(document) as ComponentDocument,
    ),
  };
}
