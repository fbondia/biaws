import { createCatalogError } from "../../../shared/topology/errors.js";
import { normalizeDocument } from "../../../shared/topology/normalization.js";

export function executorScopeFilter(authorizationScope = {}) {
  const workspaceId = String(authorizationScope.workspaceId || "");
  if (!workspaceId) {
    throw createCatalogError(
      403,
      "FORBIDDEN",
      "Executor workspace scope is required",
    );
  }
  return {
    workspaceId,
    ...(authorizationScope.workspace
      ? {}
      : { applicationId: { $in: authorizationScope.applicationIds || [] } }),
  };
}

export function leaseResponse(monitor) {
  const normalized = normalizeDocument(monitor);
  const { lease, nameKey, ...response } = normalized;
  if (response.provider === "shell") delete response.templateRef;
  return {
    ...response,
    leaseToken: lease.token,
    executionId: lease.executionId,
    scheduledFor: lease.scheduledFor,
    leasedUntil: lease.leasedUntil,
    trigger: lease.trigger || "scheduled",
  };
}

export function manualExecutionResponse(request, status = "queued") {
  return {
    id: request.id,
    requestedAt: request.requestedAt,
    status,
    trigger: "manual",
  };
}

export function activeManualLease(monitor) {
  return monitor.lease?.trigger === "manual" && !monitor.lease.completedAt
    ? monitor.lease
    : null;
}
