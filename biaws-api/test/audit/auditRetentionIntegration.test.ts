import assert from "node:assert/strict";
import test from "node:test";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";

test(
  "audit TTL persists expiration and recalculates historical events without mutating their dates",
  {
    skip: !process.env.BIAWS_INTEGRATION_MONGO_URI,
  },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();
    process.env.BIAWS_AUDIT_RETENTION_DAYS = "10";
    const { getMongoDatabase, closeMongoClient } = await import("../../src/helpers/mongoClient.js");
    const { recordAuditEvent, recalculateAuditExpiration } = await import("../../src/repositories/audit/index.js");
    const database = await getMongoDatabase();
    const collection = database.collection("auditEvents");
    const occurredAt = new Date("2090-01-01T12:00:00.000Z");
    try {
      await collection.insertMany([
        ...Array.from({ length: 501 }, (_, index) => ({ action: `legacy-${index}`, occurredAt })),
        { action: "missing-date" },
        { action: "invalid-date", occurredAt: "invalid" },
      ]);
      const inspect = await recalculateAuditExpiration({ now: new Date("2090-01-20") });
      assert.equal(inspect.eligibleEvents, 501);
      assert.equal(inspect.invalidOccurredAt, 2);
      assert.equal(inspect.expiredEvents, 501);
      assert.equal(inspect.modifiedEvents, 0);
      assert.equal((await collection.indexes()).length, 1);
      assert.equal(await collection.countDocuments({ expiresAt: { $exists: true } }), 0);

      const input = { action: "new", target: { type: "issue", id: "synthetic" }, occurredAt };
      const event = await recordAuditEvent(input);
      assert.equal(event.expiresAt?.toISOString(), "2090-01-11T12:00:00.000Z");
      const persisted = await collection.findOne({ action: "new" });
      assert.deepEqual(persisted?.expiresAt, event.expiresAt);
      const ttlIndex = (await collection.indexes()).find((index) => index.name === "audit_expiration");
      assert.equal(ttlIndex?.expireAfterSeconds, 0);
      assert.deepEqual(ttlIndex?.key, { expiresAt: 1 });

      const apply = await recalculateAuditExpiration({ apply: true });
      assert.equal(apply.modifiedEvents, 501);
      assert.equal(await collection.countDocuments({ expiresAt: event.expiresAt }), 502);
      assert.equal(await collection.countDocuments({ occurredAt }), 502);
      assert.equal((await recalculateAuditExpiration({ apply: true })).modifiedEvents, 0);

      process.env.BIAWS_AUDIT_RETENTION_DAYS = "20";
      assert.equal((await recalculateAuditExpiration({ apply: true })).modifiedEvents, 502);
      assert.equal(await collection.countDocuments({ expiresAt: new Date("2090-01-21T12:00:00.000Z") }), 502);
      assert.equal(
        await collection.countDocuments({
          expiresAt: { $exists: true },
          action: { $in: ["missing-date", "invalid-date"] },
        }),
        0,
      );

      process.env.BIAWS_AUDIT_RETENTION_DAYS = "0";
      assert.equal((await recalculateAuditExpiration({ apply: true })).modifiedEvents, 502);
      assert.equal(await collection.countDocuments({ expiresAt: { $exists: true } }), 0);
      assert.equal(await collection.countDocuments({ occurredAt }), 502);
      assert.equal(Object.hasOwn(await recordAuditEvent(input), "expiresAt"), false);
      assert.equal((await recalculateAuditExpiration({ apply: true })).modifiedEvents, 0);
    } finally {
      await database.dropDatabase();
      await closeMongoClient();
    }
  },
);
