import {
  DEPLOYMENT_STATUSES,
  RUNTIME_STATUSES,
  SERVER_STATUSES,
} from "../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import {
  buildScopedListFilter,
  pagination,
} from "../shared/topology/filters.js";
import { createCatalogError } from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalWorkspace } from "../shared/topology/context.js";

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
  if (query.collectionId !== undefined) {
    const collectionId = String(query.collectionId || "").trim();
    filter.collectionId = collectionId || { $in: ["", null] };
  }
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
