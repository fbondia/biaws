import type { Db } from "mongodb";
import { ISSUES_COLLECTION } from "./constants.js";

export async function ensureIndexes(db: Db) {
  await db.collection(ISSUES_COLLECTION).createIndex(
    { workspaceId: 1, identifier: 1 },
    {
      unique: true,
      partialFilterExpression: { identifier: { $type: "string" } },
    },
  );
  await Promise.all([
    db
      .collection(ISSUES_COLLECTION)
      .createIndex({ id: 1 }, { unique: true, name: "issue_id_unique" }),
    db.collection(ISSUES_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      updatedAt: -1,
      id: 1,
    }),
    db.collection(ISSUES_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      "dates.receivedEmailAt": -1,
      updatedAt: -1,
      id: 1,
    }),
    db.collection(ISSUES_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
  ]);
}
