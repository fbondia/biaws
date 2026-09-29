import { AUDIT_COLLECTION } from "./constants.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

export async function auditCollection() {
  const db = await getMongoDatabase();
  const collection = db.collection(AUDIT_COLLECTION);
  await Promise.all([
    collection.createIndex({ rootType: 1, rootId: 1, occurredAt: -1 }),
    collection.createIndex({
      "target.type": 1,
      "target.id": 1,
      occurredAt: -1,
    }),
    collection.createIndex({ "actor.userId": 1, occurredAt: -1 }),
    collection.createIndex({ occurredAt: -1 }),
  ]);
  return collection;
}
