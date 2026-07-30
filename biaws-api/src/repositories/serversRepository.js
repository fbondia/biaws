import { randomUUID } from "node:crypto";

import {
  CATALOG_LIMITS,
  DEPLOYMENT_STATUSES,
  RUNTIME_STATUSES,
  SERVER_STATUSES,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  actorId,
  archiveFields,
  assertAllowedFields,
  assertCredentialFreeUrl,
  buildScopedListFilter,
  createBaseDocument,
  createCatalogError,
  duplicateKeyError,
  getTopologyCollections,
  normalizeDocument,
  normalizeEnum,
  normalizeKey,
  normalizeStringArray,
  normalizeTags,
  optionalText,
  pagination,
  requiredText,
  requireOperationalWorkspace,
} from "./topologyRepositorySupport.js";

const MUTABLE_SERVER_STATUSES = SERVER_STATUSES.filter(
  (status) => status !== "archived",
);

function normalizeAddresses(value, current = []) {
  const addresses = normalizeStringArray(value, "addresses", {
    limit: CATALOG_LIMITS.addresses,
    itemLimit: CATALOG_LIMITS.address,
    current,
  });
  for (const [index, address] of addresses.entries()) {
    if (/[\u0000-\u001f\u007f]/u.test(address)) {
      throw createCatalogError(
        422,
        "INVALID_SERVER_ADDRESS",
        `addresses[${index}] contains control characters`,
      );
    }
    if (address.includes("://")) {
      let url;
      try {
        url = new URL(address);
      } catch {
        throw createCatalogError(
          422,
          "INVALID_SERVER_ADDRESS",
          `addresses[${index}] must be a valid address`,
        );
      }
      assertCredentialFreeUrl(url, `addresses[${index}]`);
    }
  }
  return addresses;
}

export function normalizeServerInput(payload = {}, current = null) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "description",
      "hostname",
      "addresses",
      "provider",
      "location",
      "operatingSystem",
      "purpose",
      "status",
      "tags",
    ],
    "server",
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
    hostname: optionalText(
      payload.hostname ?? current?.hostname,
      "hostname",
      CATALOG_LIMITS.hostname,
    ),
    addresses: normalizeAddresses(payload.addresses, current?.addresses),
    provider: optionalText(
      payload.provider ?? current?.provider,
      "provider",
      CATALOG_LIMITS.provider,
    ),
    location: optionalText(
      payload.location ?? current?.location,
      "location",
      CATALOG_LIMITS.location,
    ),
    operatingSystem: optionalText(
      payload.operatingSystem ?? current?.operatingSystem,
      "operatingSystem",
      CATALOG_LIMITS.operatingSystem,
    ),
    purpose: optionalText(
      payload.purpose ?? current?.purpose,
      "purpose",
      CATALOG_LIMITS.purpose,
    ),
    status: normalizeEnum(
      payload.status,
      "status",
      MUTABLE_SERVER_STATUSES,
      current?.status || "active",
    ),
    tags: normalizeTags(payload.tags, current?.tags),
  };
}

export async function listServers(workspaceId, query = {}) {
  const workspace = await requireOperationalWorkspace(workspaceId);
  const { servers } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: workspace.id,
    statuses: SERVER_STATUSES,
    query,
    searchFields: [
      "key",
      "name",
      "description",
      "hostname",
      "addresses",
      "provider",
      "location",
    ],
  });
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    servers
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    servers.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.SERVERS,
      workspaceId: workspace.id,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function getServer(serverId, { workspaceId } = {}) {
  const { servers } = await getTopologyCollections();
  const filter = { id: String(serverId) };
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const server = normalizeDocument(await servers.findOne(filter));
  if (!server) return null;
  await requireOperationalWorkspace(server.workspaceId);
  return server;
}

export async function createServer(workspaceId, payload = {}, actor = {}) {
  const workspace = await requireOperationalWorkspace(workspaceId, {
    active: true,
  });
  const normalized = normalizeServerInput(payload);
  const document = {
    id: randomUUID(),
    ...createBaseDocument({
      key: normalized.key,
      workspaceId: workspace.id,
      actor,
    }),
    ...normalized,
  };
  const { servers } = await getTopologyCollections();
  try {
    await servers.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "SERVER_KEY_CONFLICT",
      "A server with this key already exists in the workspace",
    );
  }
  return normalizeDocument(document);
}

export async function updateServer(serverId, payload = {}, actor = {}) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  if (current.status === "archived") {
    throw createCatalogError(409, "SERVER_ARCHIVED", "Server is archived");
  }
  await requireOperationalWorkspace(current.workspaceId, { active: true });
  const normalized = normalizeServerInput(payload, current);
  const { servers } = await getTopologyCollections();
  const result = await servers.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
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
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "SERVER_CONCURRENT_UPDATE",
      "Server changed concurrently; reload and try again",
    );
  }
  return getServer(current.id);
}

export async function archiveServer(serverId, actor = {}) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  if (current.status === "archived") return current;
  const { runtimes, servers } = await getTopologyCollections();
  const activeRuntimes = await runtimes.countDocuments({
    workspaceId: current.workspaceId,
    serverId: current.id,
    status: { $ne: "archived" },
  });
  if (activeRuntimes) {
    throw createCatalogError(
      409,
      "SERVER_IN_USE",
      "Archive or move runtimes before archiving the server",
    );
  }
  await servers.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      status: { $ne: "archived" },
    },
    { $set: archiveFields(actor) },
  );
  return getServer(current.id);
}

export async function listServerRuntimes(serverId, query = {}) {
  const server = await getServer(serverId);
  if (!server) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  const { runtimes } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: server.workspaceId,
    statuses: RUNTIME_STATUSES,
    query,
    searchFields: ["key", "name", "endpoint", "namespace", "runtimeName"],
  });
  filter.serverId = server.id;
  if (query.authorizationScope && query.authorizationScope.workspace !== true) {
    filter.applicationId = {
      $in: (query.authorizationScope?.applicationIds || []).map(String),
    };
  }
  if (query.applicationId) {
    const requested = String(query.applicationId);
    filter.applicationId =
      query.authorizationScope?.workspace === true ||
      query.authorizationScope?.applicationIds?.includes(requested)
        ? requested
        : { $in: [] };
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    runtimes
      .find(filter)
      .sort({ name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    runtimes.countDocuments(filter),
  ]);
  return {
    meta: {
      serverId: server.id,
      workspaceId: server.workspaceId,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}

export async function listServerDeployments(serverId, query = {}) {
  const server = await getServer(serverId);
  if (!server) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  const { deployments, runtimes } = await getTopologyCollections();
  const runtimeFilter = {
    workspaceId: server.workspaceId,
    serverId: server.id,
  };
  if (String(query.includeArchived || "").toLowerCase() !== "true") {
    runtimeFilter.status = { $ne: "archived" };
  }
  if (query.applicationId) {
    const requested = String(query.applicationId);
    runtimeFilter.applicationId =
      query.authorizationScope?.workspace === true ||
      query.authorizationScope?.applicationIds?.includes(requested)
        ? requested
        : { $in: [] };
  } else if (
    query.authorizationScope &&
    query.authorizationScope.workspace !== true
  ) {
    runtimeFilter.applicationId = {
      $in: (query.authorizationScope?.applicationIds || []).map(String),
    };
  }
  const deploymentIds = await runtimes.distinct("deploymentId", runtimeFilter);
  const filter = buildScopedListFilter({
    workspaceId: server.workspaceId,
    statuses: DEPLOYMENT_STATUSES,
    query,
    searchFields: ["key", "name", "environment", "version"],
  });
  filter.id = { $in: deploymentIds };
  if (query.authorizationScope && query.authorizationScope.workspace !== true) {
    filter.applicationId = {
      $in: (query.authorizationScope?.applicationIds || []).map(String),
    };
  }
  if (query.applicationId) {
    const requested = String(query.applicationId);
    filter.applicationId =
      query.authorizationScope?.workspace === true ||
      query.authorizationScope?.applicationIds?.includes(requested)
        ? requested
        : { $in: [] };
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    deployments
      .find(filter)
      .sort({ deployedAt: -1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    deployments.countDocuments(filter),
  ]);
  return {
    meta: {
      serverId: server.id,
      workspaceId: server.workspaceId,
      total,
      page,
      limit,
    },
    items: documents.map(normalizeDocument),
  };
}
