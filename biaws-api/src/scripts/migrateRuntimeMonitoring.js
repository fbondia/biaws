#!/usr/bin/env node

import "../config.js";

import {
  CATALOG_LIMITS,
  DEFAULT_MONITORING_RETENTION_DAYS,
} from "../../../shared/index.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";
import { monitoringExpirationDate } from "../repositories/runtimeMonitoringRepository.js";
import { ensureRuntimeActiveMonitoringIndexes } from "../repositories/runtimeActiveMonitoringRepository.js";

const apply = process.argv.slice(2).includes("--apply");

function hasValidRetention(runtime) {
  return (
    Number.isInteger(runtime.monitoringRetentionDays) &&
    runtime.monitoringRetentionDays >= 0 &&
    runtime.monitoringRetentionDays <= CATALOG_LIMITS.monitoringRetentionDays
  );
}

function retentionDays(runtime) {
  return hasValidRetention(runtime)
    ? runtime.monitoringRetentionDays
    : DEFAULT_MONITORING_RETENTION_DAYS;
}

function manualEvent(runtime, observation, days, index) {
  const receivedAt = new Date(
    observation.receivedAt || runtime.updatedAt || runtime.createdAt,
  );
  const expiresAt = monitoringExpirationDate(receivedAt, days);
  return {
    id: observation.id || `legacy-manual:${runtime.id}:${index}`,
    workspaceId: runtime.workspaceId,
    applicationId: runtime.applicationId,
    deploymentId: runtime.deploymentId,
    runtimeId: runtime.id,
    signalId: null,
    status: observation.healthStatus || "unknown",
    observedAt: new Date(observation.observedAt || receivedAt),
    receivedAt,
    source: observation.source || "Registro manual",
    message: observation.message || "",
    metadata: observation.metadata || {},
    payload: null,
    recordedBy: observation.recordedBy || "system",
    origin: "manual",
    ...(expiresAt ? { expiresAt } : {}),
  };
}

async function migrate() {
  const database = await getMongoDatabase();
  const runtimes = database.collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES);
  const events = database.collection(
    COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS,
  );
  const groups = database.collection(COLLECTION_NAMES.PERMISSION_GROUPS);
  const passiveEventFilter = {
    $or: [{ origin: "external" }, { origin: { $exists: false } }],
  };
  const administrationFilter = {
    $or: [{ systemKey: "administration" }, { _id: "administration" }],
    permissions: { $ne: "monitoring.active.execute" },
  };
  const summary = {
    apply,
    database: database.databaseName,
    runtimes: await runtimes.countDocuments({}),
    runtimesDefaulted: 0,
    manualObservations: 0,
    monitoringEvents: await events.countDocuments({}),
    migratedManualObservations: 0,
    recalculatedEvents: 0,
    passiveEvents: await events.countDocuments(passiveEventFilter),
    administrationGroups: await groups.countDocuments(administrationFilter),
    administrationGroupsUpdated: 0,
  };

  for await (const runtime of runtimes.find({})) {
    const days = retentionDays(runtime);
    const observations = Array.isArray(runtime.observations)
      ? runtime.observations
      : [];
    if (!hasValidRetention(runtime)) {
      summary.runtimesDefaulted += 1;
    }
    summary.manualObservations += observations.length;
    if (!apply) continue;

    if (observations.length) {
      const result = await events.bulkWrite(
        observations.map((observation, index) => {
          const event = manualEvent(runtime, observation, days, index);
          return {
            updateOne: {
              filter: { id: event.id, runtimeId: runtime.id },
              update: {
                $setOnInsert: event,
              },
              upsert: true,
            },
          };
        }),
      );
      summary.migratedManualObservations += result.upsertedCount;
    }

    const eventFilter = {
      workspaceId: runtime.workspaceId,
      runtimeId: runtime.id,
    };
    const expirationResult = days
      ? await events.updateMany(eventFilter, [
          {
            $set: {
              expiresAt: {
                $add: ["$receivedAt", days * 86_400_000],
              },
            },
          },
        ])
      : await events.updateMany(eventFilter, {
          $unset: { expiresAt: "" },
        });
    summary.recalculatedEvents += expirationResult.modifiedCount;

    await runtimes.updateOne(
      { _id: runtime._id },
      {
        $set: { monitoringRetentionDays: days },
        $unset: { observations: "" },
      },
    );
  }

  if (apply) {
    await events.updateMany(passiveEventFilter, {
      $set: { origin: "passive" },
    });
    const permissionResult = await groups.updateMany(administrationFilter, {
      $addToSet: { permissions: "monitoring.active.execute" },
    });
    summary.administrationGroupsUpdated = permissionResult.modifiedCount;
    await events.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "monitoring_expiration" },
    );
    await ensureRuntimeActiveMonitoringIndexes();
  }
  console.log(JSON.stringify(summary));
}

try {
  await migrate();
} finally {
  await closeMongoClient();
}
