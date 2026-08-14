import { randomUUID } from "node:crypto";

import { normalizeActiveMonitorLeaseRequest } from "./runtimeActiveMonitoringModel.js";
import { activeMonitorCollection } from "./runtimeActiveMonitoringStorage.js";
import {
  actorId,
  createCatalogError,
  normalizeDocument,
  requiredText,
} from "./topologyRepositorySupport.js";

function executorScopeFilter(authorizationScope = {}) {
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

function leaseResponse(monitor) {
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

function manualExecutionResponse(request) {
  return {
    id: request.id,
    requestedAt: request.requestedAt,
    status: "queued",
    trigger: "manual",
  };
}

export async function requestActiveMonitorExecution(
  runtime,
  monitorId,
  actor = {},
) {
  const collection = await activeMonitorCollection();
  const filter = {
    id: String(monitorId),
    workspaceId: runtime.workspaceId,
    runtimeId: runtime.id,
    archivedAt: { $exists: false },
  };
  const current = await collection.findOne(filter);
  if (!current) {
    throw createCatalogError(
      404,
      "ACTIVE_MONITOR_NOT_FOUND",
      "Active monitor not found",
    );
  }
  if (!current.enabled) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_DISABLED",
      "Active monitor must be enabled before execution can be requested",
    );
  }
  if (current.manualRunRequest) {
    return {
      created: false,
      monitor: { id: current.id, name: current.name },
      execution: manualExecutionResponse(current.manualRunRequest),
    };
  }

  const now = new Date();
  const request = {
    id: randomUUID(),
    requestedAt: now,
    requestedBy: actorId(actor),
  };
  const updated = await collection.findOneAndUpdate(
    {
      ...filter,
      enabled: true,
      manualRunRequest: { $exists: false },
    },
    {
      $set: {
        manualRunRequest: request,
        updatedAt: now,
        updatedBy: actorId(actor),
      },
    },
    { returnDocument: "after" },
  );
  if (updated) {
    return {
      created: true,
      monitor: { id: updated.id, name: updated.name },
      execution: manualExecutionResponse(request),
    };
  }

  const concurrent = await collection.findOne(filter);
  if (concurrent?.manualRunRequest) {
    return {
      created: false,
      monitor: { id: concurrent.id, name: concurrent.name },
      execution: manualExecutionResponse(concurrent.manualRunRequest),
    };
  }
  throw createCatalogError(
    409,
    "ACTIVE_MONITOR_CONCURRENT_UPDATE",
    "Active monitor changed concurrently; reload and try again",
  );
}

async function acquireExpiredLease(collection, scope, request, now) {
  const candidate = await collection.findOne(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      "lease.completedAt": { $exists: false },
      "lease.leasedUntil": { $lte: now },
    },
    { sort: { "lease.leasedUntil": 1, id: 1 } },
  );
  if (!candidate) return null;
  const leasedUntil = new Date(now.getTime() + request.leaseSeconds * 1_000);
  return collection.findOneAndUpdate(
    {
      id: candidate.id,
      workspaceId: candidate.workspaceId,
      "lease.token": candidate.lease.token,
      "lease.leasedUntil": candidate.lease.leasedUntil,
    },
    {
      $set: {
        "lease.token": randomUUID(),
        "lease.executorId": request.executorId,
        "lease.leasedAt": now,
        "lease.leasedUntil": leasedUntil,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
}

async function acquireDueLease(collection, scope, request, now) {
  const candidate = await collection.findOne(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      nextRunAt: { $lte: now },
      $or: [
        { lease: { $exists: false } },
        { "lease.completedAt": { $exists: true } },
      ],
    },
    { sort: { nextRunAt: 1, id: 1 } },
  );
  if (!candidate) return null;
  const scheduledFor = new Date(candidate.nextRunAt);
  const leasedUntil = new Date(now.getTime() + request.leaseSeconds * 1_000);
  const leaseFilter = candidate.lease?.completedAt
    ? {
        "lease.token": candidate.lease.token,
        "lease.completedAt": candidate.lease.completedAt,
      }
    : { lease: { $exists: false } };
  return collection.findOneAndUpdate(
    {
      id: candidate.id,
      workspaceId: candidate.workspaceId,
      enabled: true,
      archivedAt: { $exists: false },
      nextRunAt: candidate.nextRunAt,
      ...leaseFilter,
    },
    {
      $set: {
        nextRunAt: new Date(
          scheduledFor.getTime() + candidate.intervalSeconds * 1_000,
        ),
        lease: {
          token: randomUUID(),
          executionId: randomUUID(),
          executorId: request.executorId,
          scheduledFor,
          leasedAt: now,
          leasedUntil,
          trigger: "scheduled",
        },
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
}

async function acquireManualLease(collection, scope, request, now) {
  const candidate = await collection.findOne(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      "manualRunRequest.requestedAt": { $lte: now },
      $or: [
        { lease: { $exists: false } },
        { "lease.completedAt": { $exists: true } },
      ],
    },
    { sort: { "manualRunRequest.requestedAt": 1, id: 1 } },
  );
  if (!candidate) return null;
  const manualRequest = candidate.manualRunRequest;
  const leasedUntil = new Date(now.getTime() + request.leaseSeconds * 1_000);
  const leaseFilter = candidate.lease?.completedAt
    ? {
        "lease.token": candidate.lease.token,
        "lease.completedAt": candidate.lease.completedAt,
      }
    : { lease: { $exists: false } };
  return collection.findOneAndUpdate(
    {
      id: candidate.id,
      workspaceId: candidate.workspaceId,
      enabled: true,
      archivedAt: { $exists: false },
      "manualRunRequest.id": manualRequest.id,
      ...leaseFilter,
    },
    {
      $set: {
        lease: {
          token: randomUUID(),
          executionId: manualRequest.id,
          executorId: request.executorId,
          scheduledFor: manualRequest.requestedAt,
          leasedAt: now,
          leasedUntil,
          trigger: "manual",
        },
        updatedAt: now,
      },
      $unset: { manualRunRequest: "" },
    },
    { returnDocument: "after" },
  );
}

export async function acquireDueActiveMonitors(
  authorizationScope,
  payload = {},
) {
  const request = normalizeActiveMonitorLeaseRequest(payload);
  const scope = executorScopeFilter(authorizationScope);
  const collection = await activeMonitorCollection();
  const items = [];
  for (
    let attempt = 0;
    items.length < request.limit && attempt < request.limit * 4;
    attempt += 1
  ) {
    const now = new Date();
    const monitor =
      (await acquireExpiredLease(collection, scope, request, now)) ||
      (await acquireManualLease(collection, scope, request, now)) ||
      (await acquireDueLease(collection, scope, request, now));
    if (!monitor) break;
    items.push(leaseResponse(monitor));
  }
  return { items };
}

export async function renewActiveMonitorLease(
  leaseToken,
  payload = {},
  authorizationScope = {},
) {
  const request = normalizeActiveMonitorLeaseRequest({ ...payload, limit: 1 });
  const scope = executorScopeFilter(authorizationScope);
  const now = new Date();
  const collection = await activeMonitorCollection();
  const monitor = await collection.findOneAndUpdate(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      "lease.token": String(leaseToken),
      "lease.executorId": request.executorId,
      "lease.completedAt": { $exists: false },
      "lease.leasedUntil": { $gt: now },
    },
    {
      $set: {
        "lease.leasedUntil": new Date(
          now.getTime() + request.leaseSeconds * 1_000,
        ),
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!monitor) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_LEASE_LOST",
      "Active monitor lease is no longer valid",
    );
  }
  return leaseResponse(monitor);
}

export async function claimActiveMonitorResult(
  leaseToken,
  executorId,
  authorizationScope = {},
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
  if (!monitor) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_LEASE_LOST",
      "Active monitor lease is no longer valid",
    );
  }
  return normalizeDocument(monitor);
}

export async function completeActiveMonitorExecution(
  monitor,
  leaseToken,
  event,
) {
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
