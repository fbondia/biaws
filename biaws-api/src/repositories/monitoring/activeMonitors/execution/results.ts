import { executorScopeFilter } from "./support.js";
import { activeMonitorCollection } from "../storage.js";
import type {
  ActiveMonitorDocument,
  MonitorLease,
} from "../../../../types/monitoring.js";
import type { AuthorizationScope } from "../../../../types/http.js";
import { isRecord } from "../../../../helpers/records.js";
import { createCatalogError } from "../../../shared/topology/errors.js";
import {
  normalizeDocument,
  requiredText,
} from "../../../shared/topology/normalization.js";

export async function claimActiveMonitorResult(
  leaseToken: string | string[],
  executorId: unknown,
  authorizationScope: AuthorizationScope = {},
) {
  const scope = executorScopeFilter(authorizationScope);
  const now = new Date();
  const collection = await activeMonitorCollection();
  const monitor = await collection.findOneAndUpdate(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      "lease.token": String(leaseToken),
      "lease.executorId": requiredText(executorId, "executorId", 160),
      $or: [
        { "lease.leasedUntil": { $gt: now } },
        { "lease.completedAt": { $exists: true } },
      ],
    },
    { $set: { "lease.publishingAt": now, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!monitor?.lease) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_LEASE_LOST",
      "Active monitor lease is no longer valid",
    );
  }
  return normalizeDocument(monitor) as ActiveMonitorDocument & {
    lease: MonitorLease;
  };
}

export async function completeActiveMonitorExecution(
  monitor: ActiveMonitorDocument & { lease: MonitorLease },
  leaseToken: string | string[],
  event: unknown,
) {
  if (
    !isRecord(event) ||
    typeof event.id !== "string" ||
    typeof event.status !== "string" ||
    !(event.observedAt instanceof Date)
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_EVENT",
      "Completed monitoring event is invalid",
    );
  }
  const now = new Date();
  const collection = await activeMonitorCollection();
  const result = await collection.updateOne(
    {
      id: monitor.id,
      workspaceId: monitor.workspaceId,
      "lease.token": String(leaseToken),
    },
    {
      $set: {
        lastExecution: {
          executionId: monitor.lease.executionId,
          scheduledFor: monitor.lease.scheduledFor,
          observedAt: event.observedAt,
          status: event.status,
          eventId: event.id,
          completedAt: now,
          trigger: monitor.lease.trigger || "scheduled",
        },
        "lease.completedAt": now,
        updatedAt: now,
      },
    },
  );
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_LEASE_LOST",
      "Active monitor lease changed before completion",
    );
  }
}
