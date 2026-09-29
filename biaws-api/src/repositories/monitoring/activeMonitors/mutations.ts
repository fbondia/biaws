import type { Actor } from "../../../types/http.js";
import { requireRuntime, validateTemplateRef } from "./context.js";
import { duplicateMonitorName, publicActiveMonitor } from "./normalization.js";
import { getRuntimeActiveMonitor } from "./queries.js";
import { randomUUID } from "node:crypto";
import { MAX_ACTIVE_MONITORS_PER_RUNTIME, normalizeActiveMonitorInput } from "./input.js";
import { activeMonitorCollection } from "./storage.js";
import { actorId } from "../../shared/topology/lifecycle.js";
import { createCatalogError } from "../../shared/topology/errors.js";

export async function createRuntimeActiveMonitor(
  runtimeId: string,
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const runtime = await requireRuntime(runtimeId, actor.workspaceId);
  const collection = await activeMonitorCollection();
  if (
    (await collection.countDocuments({
      workspaceId: runtime.workspaceId,
      runtimeId: runtime.id,
      archivedAt: { $exists: false },
    })) >= MAX_ACTIVE_MONITORS_PER_RUNTIME
  ) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_LIMIT_REACHED",
      `A runtime can have at most ${MAX_ACTIVE_MONITORS_PER_RUNTIME} active monitors`,
    );
  }
  const normalized = normalizeActiveMonitorInput(payload);
  await validateTemplateRef(normalized.templateRef, runtime);
  const now = new Date();
  const document = {
    id: randomUUID(),
    workspaceId: runtime.workspaceId,
    applicationId: runtime.applicationId,
    deploymentId: runtime.deploymentId,
    runtimeId: runtime.id,
    ...normalized,
    nextRunAt: normalized.enabled ? now : null,
    version: 1,
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await collection.insertOne(document);
  } catch (error) {
    duplicateMonitorName(error);
  }
  return publicActiveMonitor(document);
}

export async function updateRuntimeActiveMonitor(
  runtimeId: string,
  monitorId: string,
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const runtime = await requireRuntime(runtimeId, actor.workspaceId);
  const current = await getRuntimeActiveMonitor(runtime.id, monitorId, {
    workspaceId: runtime.workspaceId,
    includeLease: true,
  });
  if (!current) {
    throw createCatalogError(404, "ACTIVE_MONITOR_NOT_FOUND", "Active monitor not found");
  }
  if (!current.lease?.completedAt && current.lease?.leasedUntil && new Date(current.lease.leasedUntil) > new Date()) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_EXECUTING",
      "Active monitor is currently executing; retry after the lease expires",
    );
  }
  const normalized = normalizeActiveMonitorInput(payload, current);
  await validateTemplateRef(normalized.templateRef, runtime, {
    allowInactive: JSON.stringify(normalized.templateRef) === JSON.stringify(current.templateRef),
  });
  const scheduleChanged =
    normalized.enabled !== current.enabled ||
    normalized.intervalSeconds !== current.intervalSeconds ||
    normalized.provider !== current.provider ||
    JSON.stringify(normalized.configuration) !== JSON.stringify(current.configuration) ||
    JSON.stringify(normalized.templateRef) !== JSON.stringify(current.templateRef);
  const now = new Date();
  const nextRunAt = scheduleChanged ? now : current.nextRunAt;
  const collection = await activeMonitorCollection();
  let result;
  try {
    result = await collection.findOneAndUpdate(
      {
        id: current.id,
        workspaceId: runtime.workspaceId,
        runtimeId: runtime.id,
        version: current.version,
        archivedAt: { $exists: false },
      },
      {
        $set: {
          ...normalized,
          nextRunAt: normalized.enabled ? nextRunAt : null,
          version: current.version + 1,
          updatedAt: now,
          updatedBy: actorId(actor),
        },
        $unset: {
          lease: "",
          ...(normalized.enabled ? {} : { manualRunRequest: "" }),
        },
      },
      { returnDocument: "after" },
    );
  } catch (error) {
    duplicateMonitorName(error);
  }
  if (!result) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_CONCURRENT_UPDATE",
      "Active monitor changed concurrently; reload and try again",
    );
  }
  return publicActiveMonitor(result);
}

export async function archiveRuntimeActiveMonitor(runtimeId: string, monitorId: string, actor: Partial<Actor> = {}) {
  const current = await getRuntimeActiveMonitor(runtimeId, monitorId, {
    workspaceId: actor.workspaceId,
    includeLease: true,
  });
  if (!current) {
    throw createCatalogError(404, "ACTIVE_MONITOR_NOT_FOUND", "Active monitor not found");
  }
  if (!current.lease?.completedAt && current.lease?.leasedUntil && new Date(current.lease.leasedUntil) > new Date()) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_EXECUTING",
      "Active monitor is currently executing; retry after the lease expires",
    );
  }
  const now = new Date();
  const collection = await activeMonitorCollection();
  const result = await collection.findOneAndUpdate(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      runtimeId: current.runtimeId,
      version: current.version,
      archivedAt: { $exists: false },
    },
    {
      $set: {
        enabled: false,
        nameKey: `archived:${current.id}`,
        nextRunAt: null,
        archivedAt: now,
        archivedBy: actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
        version: current.version + 1,
      },
      $unset: { lease: "", manualRunRequest: "" },
    },
    { returnDocument: "after" },
  );
  if (!result) {
    throw createCatalogError(
      409,
      "ACTIVE_MONITOR_CONCURRENT_UPDATE",
      "Active monitor changed concurrently; reload and try again",
    );
  }
  return publicActiveMonitor(result);
}
