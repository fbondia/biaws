import { createCatalogError } from "../../shared/topology/errors.js";
import { normalizeDocument } from "../../shared/topology/normalization.js";

export function publicActiveMonitor(document) {
  const monitor = normalizeDocument(document);
  if (!monitor) return null;
  const { lease, nameKey, manualRunRequest, ...publicMonitor } = monitor;
  const pendingExecution = manualRunRequest
    ? {
        id: manualRunRequest.id,
        requestedAt: manualRunRequest.requestedAt,
        status: "queued",
        trigger: "manual",
      }
    : lease?.trigger === "manual" && !lease.completedAt
      ? {
          id: lease.executionId,
          requestedAt: lease.scheduledFor,
          status: "running",
          trigger: "manual",
        }
      : null;
  return {
    ...publicMonitor,
    ...(pendingExecution ? { pendingExecution } : {}),
  };
}

export function duplicateMonitorName(error) {
  if (error?.code !== 11000) throw error;
  throw createCatalogError(
    409,
    "ACTIVE_MONITOR_NAME_CONFLICT",
    "An active monitor with this name already exists for the runtime",
  );
}
