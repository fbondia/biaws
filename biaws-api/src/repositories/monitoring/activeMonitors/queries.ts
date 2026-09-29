import type { ActiveMonitorDocument } from "../../../types/monitoring.js";
import type { RepositoryQuery } from "../../../types/http.js";
import { requireRuntime } from "./context.js";
import { publicActiveMonitor } from "./normalization.js";
import { activeMonitorCollection } from "./storage.js";
import { normalizeDocument } from "../../shared/topology/normalization.js";
import { pagination } from "../../shared/topology/filters.js";

export async function listRuntimeActiveMonitors(
  runtimeId: string,
  query: RepositoryQuery = {},
) {
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
  runtimeId: string,
  monitorId: string | string[],
  options: { workspaceId?: string | null; includeLease: true },
): Promise<Omit<ActiveMonitorDocument, "_id"> | null>;
export async function getRuntimeActiveMonitor(
  runtimeId: string,
  monitorId: string | string[],
  options?: { workspaceId?: string | null; includeLease?: false },
): Promise<ReturnType<typeof publicActiveMonitor>>;
export async function getRuntimeActiveMonitor(
  runtimeId: string,
  monitorId: string | string[],
  {
    workspaceId,
    includeLease = false,
  }: { workspaceId?: string | null; includeLease?: boolean } = {},
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
