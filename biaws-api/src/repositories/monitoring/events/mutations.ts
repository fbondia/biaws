import type { Actor } from "../../../types/http.js";
import type { ActiveMonitorDocument, MonitorLease, MonitorTemplateRef } from "../../../types/monitoring.js";
import { isRecord } from "../../../helpers/records.js";
import { errorCode } from "../../../helpers/error.js";
import {
  normalizeMonitoringSignal,
  normalizeManualMonitoringObservation,
  monitoringExpirationDate,
  monitoringEventResponse,
} from "./normalization.js";
import {
  evaluateActiveMonitoringTemplate,
  activeObservationPayload,
  activeObservationEventContext,
} from "./templateObservation.js";
import { monitoringCollection } from "./storage.js";
import { DAY_MS } from "./constants.js";
import { randomUUID } from "node:crypto";
import { DEFAULT_MONITORING_RETENTION_DAYS } from "../../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { getRuntime } from "../../deployments/runtimes/queries.js";
import { actorId } from "../../shared/topology/lifecycle.js";
import { assertAllowedFields, normalizeDocument } from "../../shared/topology/normalization.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { evaluateMonitoringTemplateReference } from "../templates/evaluation.js";

function templateReference(value: unknown): MonitorTemplateRef | null {
  if (!value) return null;
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.version !== "string") {
    throw createCatalogError(422, "INVALID_MONITORING_TEMPLATE_REFERENCE", "templateRef must contain id and version");
  }
  return { id: value.id, version: value.version };
}

export async function recordRuntimeMonitoringSignal(
  runtimeId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: actor.workspaceId ?? undefined,
  });
  if (!runtime || runtime.status === "archived") {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const requestedTemplate = templateReference(payload.templateRef);
  const evaluation = requestedTemplate
    ? await evaluateMonitoringTemplateReference(
        requestedTemplate,
        {
          context: { origin: "passive", source: payload.source || "" },
          evidence: payload.payload || {},
          metadata: payload.metadata || {},
        },
        runtime.workspaceId,
      )
    : null;
  const normalized = normalizeMonitoringSignal(
    evaluation
      ? {
          ...payload,
          status: evaluation.result.status,
          message: evaluation.result.message,
          metadata: evaluation.result.metadata,
          metadataProfile: undefined,
          templateRef: undefined,
        }
      : payload,
    actor,
  );
  return recordMonitoringEvent(runtime, normalized, actor, {
    materializeHealth: true,
    origin: "passive",
    eventContext: evaluation
      ? {
          templateRef: evaluation.templateRef,
          templateSnapshot: evaluation.templateSnapshot,
          templateMatch: evaluation.matchedRule,
        }
      : {},
  });
}

export async function recordActiveRuntimeMonitoringObservation(
  monitor: ActiveMonitorDocument & { lease: MonitorLease },
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  assertAllowedFields(
    payload,
    ["executorId", "status", "observedAt", "source", "message", "metadata", "metadataProfile", "payload"],
    "active monitoring observation",
  );
  const runtime = await getRuntime(monitor.runtimeId, {
    workspaceId: monitor.workspaceId,
  });
  if (!runtime || runtime.status === "archived" || runtime.applicationId !== monitor.applicationId) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const templateRef = monitor.provider === "shell" ? null : monitor.templateRef || null;
  const { evaluation, evaluationFailure } = await evaluateActiveMonitoringTemplate(monitor, payload, templateRef);
  const normalized = normalizeMonitoringSignal(
    activeObservationPayload(monitor, payload, evaluation, evaluationFailure),
    actor,
  );
  const { payload: _ignoredPayload, ...shellPayload } = normalized;
  const eventPayload = monitor.provider === "shell" ? shellPayload : normalized;
  return recordMonitoringEvent(runtime, eventPayload, actor, {
    materializeHealth: true,
    origin: "active",
    eventContext: activeObservationEventContext(monitor, templateRef, evaluation, evaluationFailure),
  });
}

export async function recordManualRuntimeMonitoringObservation(
  runtimeId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: actor.workspaceId ?? undefined,
  });
  if (!runtime || runtime.status === "archived") {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const normalized = normalizeManualMonitoringObservation(payload, actor);
  return recordMonitoringEvent(runtime, normalized, actor, {
    materializeHealth: false,
    origin: "manual",
  });
}

async function recordMonitoringEvent(
  runtime: NonNullable<Awaited<ReturnType<typeof getRuntime>>>,
  normalized: Partial<Pick<ReturnType<typeof normalizeMonitoringSignal>, "payload">> &
    Omit<ReturnType<typeof normalizeMonitoringSignal>, "payload">,
  actor: Partial<Actor>,
  {
    materializeHealth,
    origin,
    eventContext = {},
  }: {
    materializeHealth: boolean;
    origin: "passive" | "active" | "manual";
    eventContext?: Record<string, unknown>;
  },
) {
  const collection = await monitoringCollection();
  const receivedAt = new Date();
  const expiresAt = monitoringExpirationDate(
    receivedAt,
    runtime.monitoringRetentionDays ?? DEFAULT_MONITORING_RETENTION_DAYS,
  );
  const signal = {
    id: randomUUID(),
    workspaceId: runtime.workspaceId,
    applicationId: runtime.applicationId,
    deploymentId: runtime.deploymentId,
    runtimeId: runtime.id,
    ...normalized,
    ...eventContext,
    origin,
    receivedAt,
    ...(expiresAt ? { expiresAt } : {}),
  };

  try {
    await collection.insertOne(signal);
  } catch (error) {
    if (errorCode(error) !== 11000 || !signal.signalId) throw error;
    const existing = normalizeDocument(
      await collection.findOne({
        workspaceId: runtime.workspaceId,
        runtimeId: runtime.id,
        signalId: signal.signalId,
      }),
    );
    return {
      created: false,
      runtime: await getRuntime(runtime.id),
      signal: monitoringEventResponse(existing),
    };
  }

  if (materializeHealth) {
    const database = await getMongoDatabase();
    await database.collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES).updateOne(
      {
        id: runtime.id,
        workspaceId: runtime.workspaceId,
        status: { $ne: "archived" },
        $or: [{ monitoringObservedAt: { $exists: false } }, { monitoringObservedAt: { $lte: signal.observedAt } }],
      },
      {
        $set: {
          status: signal.status,
          observedAt: signal.observedAt,
          monitoringObservedAt: signal.observedAt,
          monitoring: {
            signalId: signal.signalId,
            status: signal.status,
            observedAt: signal.observedAt,
            receivedAt: signal.receivedAt,
            source: signal.source,
            message: signal.message,
          },
          updatedAt: receivedAt,
          updatedBy: actorId(actor),
        },
      },
    );
  }
  return {
    created: true,
    runtime: await getRuntime(runtime.id),
    signal: monitoringEventResponse(signal),
  };
}

export async function recalculateRuntimeMonitoringExpiration(
  runtimeId: string | string[],
  retentionDays: number,
  { workspaceId }: { workspaceId?: string } = {},
) {
  const runtime = await getRuntime(runtimeId, { workspaceId });
  if (!runtime) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const collection = await monitoringCollection();
  const filter = { workspaceId: runtime.workspaceId, runtimeId: runtime.id };
  if (retentionDays > 0) {
    return collection.updateMany(filter, [
      {
        $set: {
          expiresAt: { $add: ["$receivedAt", retentionDays * DAY_MS] },
        },
      },
    ]);
  }
  return collection.updateMany(filter, { $unset: { expiresAt: "" } });
}
