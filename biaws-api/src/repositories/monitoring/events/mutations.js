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
import {
  assertAllowedFields,
  normalizeDocument,
} from "../../shared/topology/normalization.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { evaluateMonitoringTemplateReference } from "../templates/evaluation.js";

export async function recordRuntimeMonitoringSignal(
  runtimeId,
  payload = {},
  actor = {},
) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: actor.workspaceId,
  });
  if (!runtime || runtime.status === "archived") {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const evaluation = payload.templateRef
    ? await evaluateMonitoringTemplateReference(
        payload.templateRef,
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
  monitor,
  payload = {},
  actor = {},
) {
  assertAllowedFields(
    payload,
    [
      "executorId",
      "status",
      "observedAt",
      "source",
      "message",
      "metadata",
      "metadataProfile",
      "payload",
    ],
    "active monitoring observation",
  );
  const runtime = await getRuntime(monitor.runtimeId, {
    workspaceId: monitor.workspaceId,
  });
  if (
    !runtime ||
    runtime.status === "archived" ||
    runtime.applicationId !== monitor.applicationId
  ) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const templateRef =
    monitor.provider === "shell" ? null : monitor.templateRef || null;
  const { evaluation, evaluationFailure } =
    await evaluateActiveMonitoringTemplate(monitor, payload, templateRef);
  const normalized = normalizeMonitoringSignal(
    activeObservationPayload(monitor, payload, evaluation, evaluationFailure),
    actor,
  );
  if (monitor.provider === "shell") delete normalized.payload;
  return recordMonitoringEvent(runtime, normalized, actor, {
    materializeHealth: true,
    origin: "active",
    eventContext: activeObservationEventContext(
      monitor,
      templateRef,
      evaluation,
      evaluationFailure,
    ),
  });
}

export async function recordManualRuntimeMonitoringObservation(
  runtimeId,
  payload = {},
  actor = {},
) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: actor.workspaceId,
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
  runtime,
  normalized,
  actor,
  { materializeHealth, origin, eventContext = {} },
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
    if (error?.code !== 11000 || !signal.signalId) throw error;
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
        $or: [
          { monitoringObservedAt: { $exists: false } },
          { monitoringObservedAt: { $lte: signal.observedAt } },
        ],
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
  runtimeId,
  retentionDays,
  { workspaceId } = {},
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
