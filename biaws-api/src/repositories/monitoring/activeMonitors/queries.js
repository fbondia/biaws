import { requireRuntime } from "./context.js";
import { publicActiveMonitor } from "./normalization.js";
import { activeMonitorCollection } from "./storage.js";
import { normalizeDocument } from "../../shared/topology/normalization.js";
import { pagination } from "../../shared/topology/filters.js";

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
