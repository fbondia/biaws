import type { Db, ObjectId } from "mongodb";
import { NOTES_COLLECTION } from "../constants.js";

export async function readNotes(db: Db, requestIds: ObjectId[]) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(NOTES_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    const items = byRequestId.get(key) || [];
    items.push(row);
    byRequestId.set(key, items);
  }

  return byRequestId;
}
