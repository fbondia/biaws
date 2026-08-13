import { randomUUID } from "node:crypto";

import {
  DEFAULT_MONITORING_RETENTION_DAYS,
  RUNTIME_STATUSES,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { getRuntime } from "./deploymentsRepository.js";
import {
  actorId,
  assertAllowedFields,
  createCatalogError,
  normalizeDate,
  normalizeDocument,
  normalizeEnum,
  normalizeMetadata,
  optionalText,
  pagination,
  requiredText,
} from "./topologyRepositorySupport.js";
import {
  monitoringMetadataPresentation,
  normalizeMonitoringMetadataProfile,
} from "./monitoringMetadataProfiles.js";
import { evaluateMonitoringTemplateReference } from "./monitoringTemplatesRepository.js";

const SIGNAL_STATUSES = RUNTIME_STATUSES.filter(
  (status) => status !== "archived",
);
const SIGNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const PAYLOAD_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u;
const PROHIBITED_PAYLOAD_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;
const PAYLOAD_LIMITS = Object.freeze({
  arrayItems: 100,
  bytes: 65_536,
  depth: 8,
  nodes: 1_000,
  string: 8_000,
});
const DAY_MS = 86_400_000;
let collectionPromise;

async function monitoringCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(
        COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS,
      );
      await Promise.all([
        collection.createIndex({ id: 1 }, { unique: true }),
        collection.createIndex(
          { expiresAt: 1 },
          { expireAfterSeconds: 0, name: "monitoring_expiration" },
        ),
        collection.createIndex(
          { workspaceId: 1, runtimeId: 1, signalId: 1 },
          {
            unique: true,
            partialFilterExpression: { signalId: { $type: "string" } },
          },
        ),
        collection.createIndex({
          workspaceId: 1,
          applicationId: 1,
          runtimeId: 1,
          observedAt: -1,
          receivedAt: -1,
        }),
      ]);
      return collection;
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

export function normalizeMonitoringSignal(payload = {}, actor = {}) {
  assertAllowedFields(
    payload,
    [
      "signalId",
      "status",
      "observedAt",
      "source",
      "message",
      "metadata",
      "metadataProfile",
      "payload",
      "templateRef",
    ],
    "monitoring signal",
  );
  const signalId = optionalText(payload.signalId, "signalId", 128);
  if (signalId && !SIGNAL_ID_PATTERN.test(signalId)) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_SIGNAL",
      "signalId must use 1 to 128 letters, numbers, dots, colons, underscores or hyphens",
    );
  }
  const metadata = normalizeMetadata(payload.metadata, {});
  const metadataProfile = normalizeMonitoringMetadataProfile(
    payload.metadataProfile,
    metadata,
  );
  return {
    signalId: signalId || null,
    status: normalizeEnum(payload.status, "status", SIGNAL_STATUSES),
    observedAt: normalizeDate(payload.observedAt, "observedAt") || new Date(),
    source: requiredText(payload.source, "source", 160),
    message: optionalText(payload.message, "message", 4_000),
    metadata,
    ...(metadataProfile ? { metadataProfile } : {}),
    payload: normalizeMonitoringPayload(payload.payload),
    recordedBy: actorId(actor),
  };
}

export function monitoringExpirationDate(receivedAt, retentionDays) {
  const days = Number(retentionDays);
  if (!Number.isInteger(days) || days <= 0) return null;
  return new Date(new Date(receivedAt).getTime() + days * DAY_MS);
}

export function normalizeManualMonitoringObservation(payload = {}, actor = {}) {
  assertAllowedFields(
    payload,
    ["status", "observedAt", "source", "message", "metadata"],
    "manual monitoring observation",
  );
  return normalizeMonitoringSignal(
    {
      status: payload.status,
      observedAt: payload.observedAt,
      source: optionalText(payload.source, "source", 160) || "Registro manual",
      message: payload.message,
      metadata: payload.metadata,
    },
    actor,
  );
}

function assertMonitoringPayloadTraversal(state, depth) {
  state.nodes += 1;
  if (state.nodes > PAYLOAD_LIMITS.nodes) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload must contain at most ${PAYLOAD_LIMITS.nodes} values`,
    );
  }
  if (depth > PAYLOAD_LIMITS.depth) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload must contain at most ${PAYLOAD_LIMITS.depth} nested levels`,
    );
  }
}

function normalizeMonitoringPayloadString(entry, field) {
  if (entry.length > PAYLOAD_LIMITS.string) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `${field} must contain at most ${PAYLOAD_LIMITS.string} characters`,
    );
  }
  return entry;
}

function normalizeMonitoringPayloadArray(entry, field, depth, state) {
  if (entry.length > PAYLOAD_LIMITS.arrayItems) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `${field} must contain at most ${PAYLOAD_LIMITS.arrayItems} items`,
    );
  }
  return entry.map((item, index) =>
    normalizeMonitoringPayloadEntry(
      item,
      `${field}[${index}]`,
      depth + 1,
      state,
    ),
  );
}

function assertMonitoringPayloadKey(key) {
  if (
    !PAYLOAD_KEY_PATTERN.test(key) ||
    PROHIBITED_PAYLOAD_KEY.test(key) ||
    ["constructor", "prototype"].includes(key.toLowerCase())
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload key is invalid or prohibited: ${key}`,
    );
  }
}

function normalizeMonitoringPayloadObject(entry, field, depth, state) {
  const normalized = {};
  for (const [key, item] of Object.entries(entry)) {
    assertMonitoringPayloadKey(key);
    normalized[key] = normalizeMonitoringPayloadEntry(
      item,
      `${field}.${key}`,
      depth + 1,
      state,
    );
  }
  return normalized;
}

function normalizeMonitoringPayloadEntry(entry, field, depth, state) {
  assertMonitoringPayloadTraversal(state, depth);
  if (
    entry === null ||
    typeof entry === "boolean" ||
    (typeof entry === "number" && Number.isFinite(entry))
  ) {
    return entry;
  }
  if (typeof entry === "string") {
    return normalizeMonitoringPayloadString(entry, field);
  }
  if (Array.isArray(entry)) {
    return normalizeMonitoringPayloadArray(entry, field, depth, state);
  }
  if (entry && typeof entry === "object") {
    return normalizeMonitoringPayloadObject(entry, field, depth, state);
  }
  throw createCatalogError(
    422,
    "INVALID_MONITORING_PAYLOAD",
    `${field} must contain valid JSON values`,
  );
}

export function normalizeMonitoringPayload(value) {
  if (value === undefined) return null;
  const state = { nodes: 0 };
  const normalized = normalizeMonitoringPayloadEntry(
    value,
    "payload",
    0,
    state,
  );
  if (
    Buffer.byteLength(JSON.stringify(normalized), "utf8") > PAYLOAD_LIMITS.bytes
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload must contain at most ${PAYLOAD_LIMITS.bytes} bytes`,
    );
  }
  return normalized;
}

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
  let evaluation = null;
  let evaluationFailure = null;
  const templateRef =
    monitor.provider === "shell" ? null : monitor.templateRef || null;
  if (templateRef) {
    try {
      evaluation = await evaluateMonitoringTemplateReference(
        templateRef,
        {
          context: {
            origin: "active",
            provider: monitor.provider,
            monitorId: monitor.id,
          },
          evidence: payload.payload || {},
          metadata: payload.metadata || {},
        },
        monitor.workspaceId,
      );
    } catch (error) {
      if (error?.statusCode !== 422) throw error;
      evaluationFailure = error;
    }
  }
  const normalized = normalizeMonitoringSignal(
    {
      signalId: `active:${monitor.id}:${monitor.lease.executionId}`,
      status: evaluationFailure
        ? "unknown"
        : evaluation?.result.status || payload.status,
      observedAt: payload.observedAt,
      source:
        optionalText(payload.source, "source", 160) ||
        `${monitor.provider}:${monitor.name}`,
      message: evaluationFailure
        ? "Monitoring template evaluation failed"
        : evaluation?.result.message || payload.message,
      metadata: evaluationFailure
        ? {
            failure_kind: "template_evaluation",
            failure_stage: "template",
            diagnostic_code: String(
              evaluationFailure.publicDetails?.diagnostic?.code ||
                evaluationFailure.code ||
                "TEMPLATE_EVALUATION_FAILED",
            ).slice(0, 100),
          }
        : evaluation
          ? evaluation.result.metadata
          : payload.metadata,
      metadataProfile:
        evaluation || evaluationFailure ? undefined : payload.metadataProfile,
      payload: monitor.provider === "shell" ? undefined : payload.payload,
    },
    actor,
  );
  return recordMonitoringEvent(runtime, normalized, actor, {
    materializeHealth: true,
    origin: "active",
    eventContext: {
      monitorId: monitor.id,
      executionId: monitor.lease.executionId,
      scheduledFor: monitor.lease.scheduledFor,
      provider: monitor.provider,
      ...(templateRef ? { templateRef: { ...templateRef } } : {}),
      ...(evaluation
        ? {
            templateSnapshot: evaluation.templateSnapshot,
            templateMatch: evaluation.matchedRule,
          }
        : {}),
      ...(evaluationFailure?.templateSnapshot
        ? { templateSnapshot: evaluationFailure.templateSnapshot }
        : {}),
    },
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

export async function listRuntimeMonitoringSignals(runtimeId, query = {}) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: query.workspaceId,
  });
  if (!runtime) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const { page, limit, skip } = pagination(query);
  const collection = await monitoringCollection();
  const filter = buildRuntimeMonitoringSignalFilter(runtime, query);
  filter.$or = [
    { origin: "passive" },
    { origin: "external" },
    { origin: { $exists: false } },
  ];
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ observedAt: -1, receivedAt: -1, id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: { runtimeId: runtime.id, total, page, limit },
    items: items.map(monitoringEventResponse),
  };
}

function monitoringEventResponse(signal) {
  const event = normalizeDocument(signal);
  const metadataPresentation = monitoringMetadataPresentation(
    event?.metadataProfile,
  );
  return {
    ...event,
    origin:
      !event?.origin || event.origin === "external" ? "passive" : event.origin,
    ...(metadataPresentation ? { metadataPresentation } : {}),
  };
}

function timelineEvent(signal) {
  return {
    ...monitoringEventResponse(signal),
    payload: signal.payload ?? null,
  };
}

export async function listRuntimeMonitoringTimeline(runtimeId, query = {}) {
  const runtime = await getRuntime(runtimeId, {
    workspaceId: query.workspaceId,
  });
  if (!runtime) {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  const { page, limit, skip } = pagination(query);
  const filter = buildRuntimeMonitoringSignalFilter(runtime, query);
  const collection = await monitoringCollection();
  const [events, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ observedAt: -1, receivedAt: -1, id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      runtimeId: runtime.id,
      total,
      page,
      limit,
    },
    items: events.map(timelineEvent),
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

export function buildRuntimeMonitoringSignalFilter(runtime, query = {}) {
  const filter = {
    workspaceId: runtime.workspaceId,
    runtimeId: runtime.id,
  };
  if (query.status) {
    filter.status = normalizeEnum(query.status, "status", SIGNAL_STATUSES);
  }
  const observedFrom = normalizeDate(query.observedFrom, "observedFrom", null);
  const observedTo = normalizeDate(query.observedTo, "observedTo", null);
  if (observedFrom || observedTo) {
    filter.observedAt = {};
    if (observedFrom) filter.observedAt.$gte = observedFrom;
    if (observedTo) {
      if (/^\d{4}-\d{2}-\d{2}$/u.test(String(query.observedTo))) {
        const nextDay = new Date(observedTo);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        filter.observedAt.$lt = nextDay;
      } else {
        filter.observedAt.$lte = observedTo;
      }
    }
    const exclusiveUpperBound = filter.observedAt.$lt;
    const inclusiveUpperBound = filter.observedAt.$lte;
    if (
      observedFrom &&
      ((exclusiveUpperBound && observedFrom >= exclusiveUpperBound) ||
        (inclusiveUpperBound && observedFrom > inclusiveUpperBound))
    ) {
      throw createCatalogError(
        422,
        "INVALID_MONITORING_FILTER",
        "observedTo must be on or after observedFrom",
      );
    }
  }
  return filter;
}

export async function getApplicationMonitoringHealth(
  applicationId,
  workspaceId,
) {
  const database = await getMongoDatabase();
  const runtimes = database.collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES);
  const grouped = await runtimes
    .aggregate([
      {
        $match: {
          workspaceId: String(workspaceId),
          applicationId: String(applicationId),
          status: { $ne: "archived" },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          lastObservedAt: { $max: "$monitoringObservedAt" },
        },
      },
    ])
    .toArray();
  const counts = Object.fromEntries(
    SIGNAL_STATUSES.map((status) => [status, 0]),
  );
  let lastObservedAt = null;
  for (const entry of grouped) {
    if (Object.hasOwn(counts, entry._id)) counts[entry._id] = entry.count;
    if (
      entry.lastObservedAt &&
      (!lastObservedAt || entry.lastObservedAt > lastObservedAt)
    ) {
      lastObservedAt = entry.lastObservedAt;
    }
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const priority = ["unavailable", "degraded", "stopped", "unknown", "healthy"];
  return {
    applicationId: String(applicationId),
    status: priority.find((status) => counts[status] > 0) || "unknown",
    counts,
    total,
    observed: total - counts.unknown,
    lastObservedAt,
  };
}
