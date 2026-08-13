import { randomUUID } from "node:crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getRuntime } from "./deploymentsRepository.js";
import {
  MAX_ACTIVE_MONITORS_PER_RUNTIME,
  normalizeActiveMonitorInput,
} from "./runtimeActiveMonitoringModel.js";
import {
  activeMonitorCollection,
  ensureRuntimeActiveMonitoringIndexes,
} from "./runtimeActiveMonitoringStorage.js";
import {
  actorId,
  createCatalogError,
  normalizeDocument,
  pagination,
} from "./topologyRepositorySupport.js";

export { ensureRuntimeActiveMonitoringIndexes };

async function validateTemplateRef(
  templateRef,
  runtime,
  { allowInactive = false } = {},
) {
  if (!templateRef) return;
  const database = await getMongoDatabase();
  const template = await database
    .collection(COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES)
    .findOne({
      id: templateRef.id,
      version: templateRef.version,
      workspaceId: runtime.workspaceId,
      status: allowInactive ? { $ne: "archived" } : "active",
    });
  if (!template) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_TEMPLATE",
      "template must be active, match the requested version and belong to the runtime workspace",
    );
  }
}

function publicActiveMonitor(document) {
  const monitor = normalizeDocument(document);
  if (!monitor) return null;
  const { lease, nameKey, ...publicMonitor } = monitor;
  return publicMonitor;
}

function duplicateMonitorName(error) {
  if (error?.code !== 11000) throw error;
  throw createCatalogError(
    409,
    "ACTIVE_MONITOR_NAME_CONFLICT",
    "An active monitor with this name already exists for the runtime",
  );
}

async function requireRuntime(runtimeId, workspaceId) {
  const runtime = await getRuntime(runtimeId, { workspaceId });
  if (!runtime || runtime.status === "archived") {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  return runtime;
}

export async function createRuntimeActiveMonitor(
  runtimeId,
  payload = {},
  actor = {},
) {
  const runtime = await requireRuntime(runtimeId, actor.workspaceId);
  const collection = await activeMonitorCollection();
  if (
    (await collection.countDocuments({
      workspaceId: runtime.workspaceId,
      runtimeId: runtime.id,
      archivedAt: { $exists: false },
    })) >= MAX_ACTIVE_MONITORS_PER_RUNTIME
  ) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_LIMIT_REACHED",
      `A runtime can have at most ${MAX_ACTIVE_MONITORS_PER_RUNTIME} active monitors`,
    );
  }
  const normalized = normalizeActiveMonitorInput(payload);
  await validateTemplateRef(normalized.templateRef, runtime);
  const now = new Date();
  const document = {
    id: randomUUID(),
    workspaceId: runtime.workspaceId,
    applicationId: runtime.applicationId,
    deploymentId: runtime.deploymentId,
    runtimeId: runtime.id,
    ...normalized,
    nextRunAt: normalized.enabled ? now : null,
    version: 1,
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await collection.insertOne(document);
  } catch (error) {
    duplicateMonitorName(error);
  }
  return publicActiveMonitor(document);
}

export async function listRuntimeActiveMonitors(runtimeId, query = {}) {
  const runtime = await requireRuntime(runtimeId, query.workspaceId);
  const { page, limit, skip } = pagination(query);
  const collection = await activeMonitorCollection();
  const filter = {
    workspaceId: runtime.workspaceId,
    runtimeId: runtime.id,
    archivedAt: { $exists: false },
  };
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ nameKey: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: { runtimeId: runtime.id, total, page, limit },
    items: items.map(publicActiveMonitor),
  };
}

export async function getMonitoredRuntimeTopology(authorizationScope = {}) {
  const workspaceId = String(authorizationScope.workspaceId || "");
  if (!workspaceId) {
    return {
      applicationIds: [],
      componentIds: [],
      deploymentIds: [],
      runtimeIds: [],
    };
  }
  const applicationIds = authorizationScope.workspace
    ? []
    : (authorizationScope.applicationIds || []).map(String);
  const collection = await activeMonitorCollection();
  const monitoredRuntimeIds = await collection.distinct("runtimeId", {
    workspaceId,
    archivedAt: { $exists: false },
    ...(authorizationScope.workspace
      ? {}
      : { applicationId: { $in: applicationIds } }),
  });
  if (!monitoredRuntimeIds.length) {
    return {
      applicationIds: [],
      componentIds: [],
      deploymentIds: [],
      runtimeIds: [],
    };
  }
  const database = await getMongoDatabase();
  const runtimes = await database
    .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
    .find(
      {
        workspaceId,
        id: { $in: monitoredRuntimeIds },
        status: { $ne: "archived" },
        ...(authorizationScope.workspace
          ? {}
          : { applicationId: { $in: applicationIds } }),
      },
      {
        projection: {
          _id: 0,
          id: 1,
          applicationId: 1,
          componentId: 1,
          deploymentId: 1,
        },
      },
    )
    .toArray();
  const unique = (field) =>
    [
      ...new Set(runtimes.map((runtime) => runtime[field]).filter(Boolean)),
    ].sort();
  return {
    applicationIds: unique("applicationId"),
    componentIds: unique("componentId"),
    deploymentIds: unique("deploymentId"),
    runtimeIds: unique("id"),
  };
}

export async function getRuntimeActiveMonitor(
  runtimeId,
  monitorId,
  { workspaceId, includeLease = false } = {},
) {
  const runtime = await requireRuntime(runtimeId, workspaceId);
  const collection = await activeMonitorCollection();
  const monitor = normalizeDocument(
    await collection.findOne({
      id: String(monitorId),
      workspaceId: runtime.workspaceId,
      runtimeId: runtime.id,
      archivedAt: { $exists: false },
    }),
  );
  return includeLease ? monitor : publicActiveMonitor(monitor);
}

export async function updateRuntimeActiveMonitor(
  runtimeId,
  monitorId,
  payload = {},
  actor = {},
) {
  const runtime = await requireRuntime(runtimeId, actor.workspaceId);
  const current = await getRuntimeActiveMonitor(runtime.id, monitorId, {
    workspaceId: runtime.workspaceId,
    includeLease: true,
  });
  if (!current) {
    throw createCatalogError(
      404,
      "ACTIVE_MONITOR_NOT_FOUND",
      "Active monitor not found",
    );
  }
  if (
    !current.lease?.completedAt &&
    current.lease?.leasedUntil &&
    new Date(current.lease.leasedUntil) > new Date()
  ) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_EXECUTING",
      "Active monitor is currently executing; retry after the lease expires",
    );
  }
  const normalized = normalizeActiveMonitorInput(payload, current);
  await validateTemplateRef(normalized.templateRef, runtime, {
    allowInactive:
      JSON.stringify(normalized.templateRef) ===
      JSON.stringify(current.templateRef),
  });
  const scheduleChanged =
    normalized.enabled !== current.enabled ||
    normalized.intervalSeconds !== current.intervalSeconds ||
    normalized.provider !== current.provider ||
    JSON.stringify(normalized.configuration) !==
      JSON.stringify(current.configuration) ||
    JSON.stringify(normalized.templateRef) !==
      JSON.stringify(current.templateRef);
  const now = new Date();
  const collection = await activeMonitorCollection();
  let result;
  try {
    result = await collection.findOneAndUpdate(
      {
        id: current.id,
        workspaceId: runtime.workspaceId,
        runtimeId: runtime.id,
        version: current.version,
        archivedAt: { $exists: false },
      },
      {
        $set: {
          ...normalized,
          nextRunAt: normalized.enabled
            ? scheduleChanged
              ? now
              : current.nextRunAt
            : null,
          version: current.version + 1,
          updatedAt: now,
          updatedBy: actorId(actor),
        },
        $unset: { lease: "" },
      },
      { returnDocument: "after" },
    );
  } catch (error) {
    duplicateMonitorName(error);
  }
  if (!result) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_CONCURRENT_UPDATE",
      "Active monitor changed concurrently; reload and try again",
    );
  }
  return publicActiveMonitor(result);
}

export async function archiveRuntimeActiveMonitor(
  runtimeId,
  monitorId,
  actor = {},
) {
  const current = await getRuntimeActiveMonitor(runtimeId, monitorId, {
    workspaceId: actor.workspaceId,
    includeLease: true,
  });
  if (!current) {
    throw createCatalogError(
      404,
      "ACTIVE_MONITOR_NOT_FOUND",
      "Active monitor not found",
    );
  }
  if (
    !current.lease?.completedAt &&
    current.lease?.leasedUntil &&
    new Date(current.lease.leasedUntil) > new Date()
  ) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_EXECUTING",
      "Active monitor is currently executing; retry after the lease expires",
    );
  }
  const now = new Date();
  const collection = await activeMonitorCollection();
  const result = await collection.findOneAndUpdate(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      runtimeId: current.runtimeId,
      version: current.version,
      archivedAt: { $exists: false },
    },
    {
      $set: {
        enabled: false,
        nameKey: `archived:${current.id}`,
        nextRunAt: null,
        archivedAt: now,
        archivedBy: actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
        version: current.version + 1,
      },
      $unset: { lease: "" },
    },
    { returnDocument: "after" },
  );
  if (!result) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_CONCURRENT_UPDATE",
      "Active monitor changed concurrently; reload and try again",
    );
  }
  return publicActiveMonitor(result);
}
