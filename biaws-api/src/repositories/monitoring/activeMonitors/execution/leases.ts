import { executorScopeFilter, leaseResponse } from "./support.js";
import { randomUUID } from "node:crypto";
import { normalizeActiveMonitorLeaseRequest } from "../input.js";
import { activeMonitorCollection } from "../storage.js";
import { createCatalogError } from "../../../shared/topology/errors.js";
import type { AuthorizationScope } from "../../../../types/http.js";

type MonitorCollection = Awaited<ReturnType<typeof activeMonitorCollection>>;
type LeaseRequest = ReturnType<typeof normalizeActiveMonitorLeaseRequest>;
type ExecutorScope = ReturnType<typeof executorScopeFilter>;

async function acquireExpiredLease(
  collection: MonitorCollection,
  scope: ExecutorScope,
  request: LeaseRequest,
  now: Date,
) {
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
  if (!candidate.lease?.token || !candidate.lease.leasedUntil) return null;
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

async function acquireDueLease(collection: MonitorCollection, scope: ExecutorScope, request: LeaseRequest, now: Date) {
  const candidate = await collection.findOne(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      nextRunAt: { $lte: now },
      $or: [{ lease: { $exists: false } }, { "lease.completedAt": { $exists: true } }],
    },
    { sort: { nextRunAt: 1, id: 1 } },
  );
  if (!candidate?.nextRunAt) return null;
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
        nextRunAt: new Date(scheduledFor.getTime() + candidate.intervalSeconds * 1_000),
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

async function acquireManualLease(
  collection: MonitorCollection,
  scope: ExecutorScope,
  request: LeaseRequest,
  now: Date,
) {
  const candidate = await collection.findOne(
    {
      ...scope,
      enabled: true,
      archivedAt: { $exists: false },
      "manualRunRequest.requestedAt": { $lte: now },
      $or: [
        { lease: { $exists: false } },
        { "lease.completedAt": { $exists: true } },
        {
          "lease.completedAt": { $exists: false },
          "lease.leasedUntil": { $lte: now },
        },
      ],
    },
    { sort: { "manualRunRequest.requestedAt": 1, id: 1 } },
  );
  if (!candidate?.manualRunRequest) return null;
  const manualRequest = candidate.manualRunRequest;
  const leasedUntil = new Date(now.getTime() + request.leaseSeconds * 1_000);
  let leaseFilter: Record<string, unknown> = { lease: { $exists: false } };
  if (candidate.lease?.completedAt) {
    leaseFilter = {
      "lease.token": candidate.lease.token,
      "lease.completedAt": candidate.lease.completedAt,
    };
  } else if (candidate.lease) {
    leaseFilter = {
      "lease.token": candidate.lease.token,
      "lease.completedAt": { $exists: false },
      "lease.leasedUntil": candidate.lease.leasedUntil,
    };
  }
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
  authorizationScope: AuthorizationScope = {},
  payload: Record<string, unknown> = {},
) {
  const request = normalizeActiveMonitorLeaseRequest(payload);
  const scope = executorScopeFilter(authorizationScope);
  const collection = await activeMonitorCollection();
  const items = [];
  for (let attempt = 0; items.length < request.limit && attempt < request.limit * 4; attempt += 1) {
    const now = new Date();
    const monitor =
      (await acquireManualLease(collection, scope, request, now)) ??
      (await acquireExpiredLease(collection, scope, request, now)) ??
      (await acquireDueLease(collection, scope, request, now));
    if (!monitor) break;
    items.push(leaseResponse(monitor));
  }
  return { items };
}

export async function renewActiveMonitorLease(
  leaseToken: string | string[],
  payload: Record<string, unknown> = {},
  authorizationScope: AuthorizationScope = {},
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
        "lease.leasedUntil": new Date(now.getTime() + request.leaseSeconds * 1_000),
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!monitor) {
    throw createCatalogError(409, "ACTIVE_MONITOR_LEASE_LOST", "Active monitor lease is no longer valid");
  }
  return leaseResponse(monitor);
}
