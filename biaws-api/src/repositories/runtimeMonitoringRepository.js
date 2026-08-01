import { randomUUID } from "node:crypto";

import { RUNTIME_STATUSES } from "../../../shared/index.js";
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

const SIGNAL_STATUSES = RUNTIME_STATUSES.filter(
  (status) => status !== "archived",
);
const SIGNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
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
    ["signalId", "status", "observedAt", "source", "message", "metadata"],
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
  return {
    signalId: signalId || null,
    status: normalizeEnum(payload.status, "status", SIGNAL_STATUSES),
    observedAt: normalizeDate(payload.observedAt, "observedAt") || new Date(),
    source: requiredText(payload.source, "source", 160),
    message: optionalText(payload.message, "message", 4_000),
    metadata: normalizeMetadata(payload.metadata, {}),
    recordedBy: actorId(actor),
  };
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
  const normalized = normalizeMonitoringSignal(payload, actor);
  const collection = await monitoringCollection();
  const receivedAt = new Date();
  const signal = {
    id: randomUUID(),
    workspaceId: runtime.workspaceId,
    applicationId: runtime.applicationId,
    deploymentId: runtime.deploymentId,
    runtimeId: runtime.id,
    ...normalized,
    receivedAt,
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
      signal: existing,
    };
  }

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
  return {
    created: true,
    runtime: await getRuntime(runtime.id),
    signal: normalizeDocument(signal),
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
  const filter = { workspaceId: runtime.workspaceId, runtimeId: runtime.id };
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
    items: items.map(normalizeDocument),
  };
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
