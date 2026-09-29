import assert from "node:assert/strict";
import test from "node:test";
import { MongoClient } from "mongodb";
import { isolatedDatabaseName } from "../support/integration.js";
import {
  buildRuntimeMonitoringSummaryPipeline,
  normalizeRuntimeMonitoringSummaryQuery,
} from "../../src/repositories/monitoring/events/summary.js";

const mongoUri = process.env.BIAWS_INTEGRATION_MONGO_URI;

test("monitoring summary ranks every status in MongoDB aggregation", { skip: !mongoUri }, async () => {
  const client = new MongoClient(mongoUri!);
  await client.connect();
  const db = client.db(isolatedDatabaseName());
  const statuses = ["stopped", "unavailable", "degraded", "unknown", "healthy", "unrecognized"];
  try {
    await db.collection("events").insertMany(
      statuses.map((status) => ({
        id: status,
        monitorId: status,
        monitorName: status,
        observedAt: new Date("2026-08-01T01:00:00.000Z"),
        origin: "active",
        receivedAt: new Date("2026-08-01T01:00:00.000Z"),
        runtimeId: "runtime-1",
        status,
        workspaceId: "workspace-1",
      })),
    );
    const settings = normalizeRuntimeMonitoringSummaryQuery({
      observedFrom: "2026-08-01T00:00:00.000Z",
      observedTo: "2026-08-01T12:00:00.000Z",
      resolution: "1h",
    });
    const rows = await db
      .collection("events")
      .aggregate(
        buildRuntimeMonitoringSummaryPipeline({ runtimeId: "runtime-1", workspaceId: "workspace-1" }, settings),
      )
      .toArray();
    assert.deepEqual(Object.fromEntries(rows.map((row) => [row.monitorId, row.worstSeverity])), {
      stopped: 0,
      unavailable: 1,
      degraded: 2,
      unknown: 3,
      healthy: 4,
      unrecognized: 3,
    });
  } finally {
    await db.dropDatabase();
    await client.close();
  }
});
