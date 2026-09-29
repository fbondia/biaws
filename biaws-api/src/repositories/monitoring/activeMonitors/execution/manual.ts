import type { Actor } from "../../../../types/http.js";
import { manualExecutionResponse, activeManualLease } from "./support.js";
import { randomUUID } from "node:crypto";
import { activeMonitorCollection } from "../storage.js";
import { actorId } from "../../../shared/topology/lifecycle.js";
import { createCatalogError } from "../../../shared/topology/errors.js";
import { Document, ObjectId } from "mongodb";

export async function requestActiveMonitorExecution(
  runtime: Omit<Document & { _id: ObjectId } & { _id?: unknown }, "_id">,
  monitorId: string | string[],
  actor: Partial<Actor> = {},
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
    throw createCatalogError(404, "ACTIVE_MONITOR_NOT_FOUND", "Active monitor not found");
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
  const runningManualLease = activeManualLease(current);
  if (runningManualLease) {
    return {
      created: false,
      monitor: { id: current.id, name: current.name },
      execution: manualExecutionResponse(
        {
          id: runningManualLease.executionId,
          requestedAt: runningManualLease.scheduledFor,
        },
        "running",
      ),
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
      $or: [{ "lease.trigger": { $ne: "manual" } }, { "lease.completedAt": { $exists: true } }],
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
  const concurrentManualLease = activeManualLease(concurrent ?? {});
  if (concurrent && concurrentManualLease) {
    return {
      created: false,
      monitor: { id: concurrent.id, name: concurrent.name },
      execution: manualExecutionResponse(
        {
          id: concurrentManualLease.executionId,
          requestedAt: concurrentManualLease.scheduledFor,
        },
        "running",
      ),
    };
  }
  throw createCatalogError(
    409,
    "ACTIVE_MONITOR_CONCURRENT_UPDATE",
    "Active monitor changed concurrently; reload and try again",
  );
}
