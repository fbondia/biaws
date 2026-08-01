import { randomUUID } from "node:crypto";

import {
  CATALOG_LIMITS,
  REPOSITORY_PROVIDERS,
  REPOSITORY_STATUSES,
  REPOSITORY_SYNC_MODES,
  REPOSITORY_SYNC_STATES,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  actorId,
  archiveFields,
  assertAllowedFields,
  buildScopedListFilter,
  createBaseDocument,
  createCatalogError,
  duplicateKeyError,
  getTopologyCollections,
  normalizeDate,
  normalizeDocument,
  normalizeEnum,
  normalizeHttpUrl,
  normalizeKey,
  optionalText,
  pagination,
  requiredText,
  requireOperationalApplication,
} from "./topologyRepositorySupport.js";

function normalizeSync(value, current = {}) {
  if (value === undefined) {
    return {
      mode: current.mode || "manual",
      lastSyncedAt: current.lastSyncedAt ?? null,
      state: current.state || "never",
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createCatalogError(
      422,
      "INVALID_REPOSITORY_SYNC",
      "sync must be an object",
    );
  }
  assertAllowedFields(value, ["mode", "lastSyncedAt", "state"], "sync");
  return {
    mode: normalizeEnum(
      value.mode,
      "sync.mode",
      REPOSITORY_SYNC_MODES,
      current.mode || "manual",
    ),
    lastSyncedAt: normalizeDate(
      value.lastSyncedAt,
      "sync.lastSyncedAt",
      current.lastSyncedAt,
    ),
    state: normalizeEnum(
      value.state,
      "sync.state",
      REPOSITORY_SYNC_STATES,
      current.state || "never",
    ),
  };
}

export function normalizeRepositoryInput(payload = {}, current = null) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "description",
      "provider",
      "organization",
      "url",
      "defaultBranch",
      "sync",
    ],
    "repository",
  );
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      CATALOG_LIMITS.description,
    ),
    provider: normalizeEnum(
      payload.provider,
      "provider",
      REPOSITORY_PROVIDERS,
      current?.provider || "other",
    ),
    organization: optionalText(
      payload.organization ?? current?.organization,
      "organization",
      CATALOG_LIMITS.organization,
    ),
    url: normalizeHttpUrl(payload.url, "url", {
      required: true,
      current: current?.url,
    }),
    defaultBranch: optionalText(
      payload.defaultBranch ?? current?.defaultBranch,
      "defaultBranch",
      CATALOG_LIMITS.branch,
    ),
    sync: normalizeSync(payload.sync, current?.sync),
  };
}

export async function listRepositories(applicationId, query = {}) {
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
    items: documents.map(normalizeDocument),
  };
}

export async function getRepository(
  repositoryId,
  { applicationId, workspaceId } = {},
) {
  const { repositories } = await getTopologyCollections();
  const filter = { id: String(repositoryId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const repository = normalizeDocument(await repositories.findOne(filter));
  if (!repository) return null;
  await requireOperationalApplication(repository.applicationId, {
    workspaceId: repository.workspaceId,
  });
  return repository;
}

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

export async function listRepositoryComponents(repositoryId, query = {}) {
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
    items: documents.map(normalizeDocument),
  };
}
