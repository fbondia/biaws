import type { WithId } from "mongodb";
import type { ActiveMonitorDocument } from "../../../../types/monitoring.js";
import type { AuthorizationScope } from "../../../../types/http.js";
import { createCatalogError } from "../../../shared/topology/errors.js";

export function executorScopeFilter(authorizationScope: AuthorizationScope = {}) {
  const workspaceId = String(authorizationScope.workspaceId || "");
  if (!workspaceId) {
    throw createCatalogError(403, "FORBIDDEN", "Executor workspace scope is required");
  }
  return {
    workspaceId,
    ...(authorizationScope.workspace ? {} : { applicationId: { $in: authorizationScope.applicationIds || [] } }),
  };
}

export function leaseResponse(monitor: WithId<ActiveMonitorDocument>) {
  const { _id, lease, nameKey, ...response } = monitor;
  if (!lease) throw createCatalogError(409, "ACTIVE_MONITOR_LEASE_LOST", "Active monitor lease is no longer valid");
  const { templateRef, ...withoutTemplateRef } = response;
  const publicResponse = response.provider === "shell" ? withoutTemplateRef : response;
  return {
    ...publicResponse,
    leaseToken: lease.token,
    executionId: lease.executionId,
    scheduledFor: lease.scheduledFor,
    leasedUntil: lease.leasedUntil,
    trigger: lease.trigger || "scheduled",
  };
}

export function manualExecutionResponse(request: { id: string; requestedAt?: Date }, status = "queued") {
  return {
    id: request.id,
    requestedAt: request.requestedAt,
    status,
    trigger: "manual",
  };
}

export function activeManualLease(monitor: Partial<ActiveMonitorDocument>) {
  return monitor.lease?.trigger === "manual" && !monitor.lease.completedAt ? monitor.lease : null;
}
