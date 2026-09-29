import type { ActiveMonitorDocument } from "../../../types/monitoring.js";
import { errorCode } from "../../../helpers/error.js";
import { Document, ObjectId } from "mongodb";
import { createCatalogError } from "../../shared/topology/errors.js";
import { normalizeDocument } from "../../shared/topology/normalization.js";

function publicActiveMonitorValue(
  document: ActiveMonitorDocument | Omit<ActiveMonitorDocument, "_id"> | null,
) {
  const monitor = normalizeDocument(
    document as ActiveMonitorDocument | null,
  ) as ActiveMonitorDocument | null;
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

export function duplicateMonitorName(error: unknown) {
  if (errorCode(error) !== 11000) throw error;
  throw createCatalogError(
    409,
    "ACTIVE_MONITOR_NAME_CONFLICT",
    "An active monitor with this name already exists for the runtime",
  );
}

export function publicActiveMonitor(
  document: NonNullable<Parameters<typeof publicActiveMonitorValue>[0]>,
): NonNullable<ReturnType<typeof publicActiveMonitorValue>>;
export function publicActiveMonitor(
  document: Parameters<typeof publicActiveMonitorValue>[0],
): ReturnType<typeof publicActiveMonitorValue>;
export function publicActiveMonitor(
  document: Parameters<typeof publicActiveMonitorValue>[0],
) {
  return publicActiveMonitorValue(document);
}
