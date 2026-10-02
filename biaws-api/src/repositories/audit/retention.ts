import { getAuditRetentionDays } from "../../config.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { DAY_MS } from "../../helpers/retention.js";
import { AUDIT_COLLECTION } from "./constants.js";
import { auditCollection } from "./storage.js";
import type { ObjectId } from "mongodb";

export async function recalculateAuditExpiration({ apply = false, now = new Date() } = {}) {
  const retentionDays = getAuditRetentionDays();
  const database = await getMongoDatabase();
  // Inspection must not create indexes or make existing events expire.
  const collection = database.collection(AUDIT_COLLECTION);
  const validDateFilter = { occurredAt: { $type: "date" } };
  const filter = retentionDays > 0 ? validDateFilter : { expiresAt: { $exists: true } };
  const totalEvents = await collection.countDocuments({});
  const eventsWithValidDate = await collection.countDocuments(validDateFilter);
  const summary = {
    apply,
    database: database.databaseName,
    retentionDays,
    totalEvents,
    eligibleEvents: await collection.countDocuments(filter),
    invalidOccurredAt: totalEvents - eventsWithValidDate,
    expiredEvents:
      retentionDays > 0
        ? await collection.countDocuments({
            occurredAt: { $type: "date", $lte: new Date(now.getTime() - retentionDays * DAY_MS) },
          })
        : 0,
    modifiedEvents: 0,
  };
  if (!apply) return summary;

  await auditCollection();
  const cursor = collection.find(filter, { projection: { _id: 1 } });
  const update =
    retentionDays > 0
      ? [{ $set: { expiresAt: { $add: ["$occurredAt", retentionDays * DAY_MS] } } }]
      : { $unset: { expiresAt: "" } };
  const batchSize = 500;
  let ids: ObjectId[] = [];
  async function updateBatch() {
    const result = await collection.updateMany({ ...filter, _id: { $in: ids } }, update);
    summary.modifiedEvents += result.modifiedCount;
    ids = [];
  }
  try {
    for await (const event of cursor) {
      ids.push(event._id);
      if (ids.length === batchSize) await updateBatch();
    }
    if (ids.length) await updateBatch();
  } finally {
    await cursor.close();
  }
  return summary;
}
