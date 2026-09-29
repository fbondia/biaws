import type { RepositoryQuery } from "../../../types/http.js";
import { monitoringCollection } from "./storage.js";
import { buildRuntimeMonitoringSignalFilter } from "./filters.js";
import { monitoringEventResponse, timelineEvent } from "./normalization.js";
import { SIGNAL_STATUSES } from "./constants.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { getRuntime } from "../../deployments/runtimes/queries.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { pagination } from "../../shared/topology/filters.js";
import {
  buildRuntimeMonitoringSummaryPipeline,
  normalizeRuntimeMonitoringSummaryQuery,
  runtimeMonitoringSummaryResponse,
} from "./summary.js";
import type { MonitoringSummaryRow } from "./summary.js";

export async function listRuntimeMonitoringSignals(runtimeId: string | string[], query: RepositoryQuery = {}) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: query.workspaceId,
  });
  if (!runtime) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const { page, limit, skip } = pagination(query);
  const collection = await monitoringCollection();
  const filter = buildRuntimeMonitoringSignalFilter(runtime, query);
  filter.$or = [{ origin: "passive" }, { origin: "external" }, { origin: { $exists: false } }];
  const [items, total] = await Promise.all([
    collection.find(filter).sort({ observedAt: -1, receivedAt: -1, id: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: { runtimeId: runtime.id, total, page, limit },
    items: items.map(monitoringEventResponse),
  };
}

export async function listRuntimeMonitoringTimeline(runtimeId: string | string[], query: RepositoryQuery = {}) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: query.workspaceId,
  });
  if (!runtime) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const { page, limit, skip } = pagination(query);
  const filter = buildRuntimeMonitoringSignalFilter(runtime, query);
  const collection = await monitoringCollection();
  const [events, total] = await Promise.all([
    collection.find(filter).sort({ observedAt: -1, receivedAt: -1, id: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      runtimeId: runtime.id,
      total,
      page,
      limit,
    },
    items: events.map(timelineEvent),
  };
}

export async function getRuntimeMonitoringHealthSummary(runtimeId: string | string[], query: RepositoryQuery = {}) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: query.workspaceId,
  });
  if (!runtime) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const settings = normalizeRuntimeMonitoringSummaryQuery(query);
  const filter = buildRuntimeMonitoringSignalFilter(runtime, {
    observedFrom: settings.observedFrom.toISOString(),
    observedTo: settings.observedTo.toISOString(),
    status: query.status,
  });
  const collection = await monitoringCollection();
  const rows = await collection
    .aggregate<MonitoringSummaryRow>(buildRuntimeMonitoringSummaryPipeline(filter, settings))
    .toArray();
  return runtimeMonitoringSummaryResponse(runtime, settings, rows);
}

export async function getApplicationMonitoringHealth(applicationId: string, workspaceId: string | null | undefined) {
  const database = await getMongoDatabase();
  const runtimes = database.collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES);
  const grouped = await runtimes
    .aggregate([
      {
        $match: {
          workspaceId: String(workspaceId),
          applicationId: String(applicationId),
          status: { $ne: "archived" },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          lastObservedAt: { $max: "$monitoringObservedAt" },
        },
      },
    ])
    .toArray();
  const counts = Object.fromEntries(SIGNAL_STATUSES.map((status) => [status, 0]));
  let lastObservedAt = null;
  for (const entry of grouped) {
    if (Object.hasOwn(counts, entry._id)) counts[entry._id] = entry.count;
    if (entry.lastObservedAt && (!lastObservedAt || entry.lastObservedAt > lastObservedAt)) {
      lastObservedAt = entry.lastObservedAt;
    }
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const priority = ["unavailable", "degraded", "stopped", "unknown", "healthy"];
  return {
    applicationId: String(applicationId),
    status: priority.find((status) => counts[status] > 0) || "unknown",
    counts,
    total,
    observed: total - counts.unknown,
    lastObservedAt,
  };
}
