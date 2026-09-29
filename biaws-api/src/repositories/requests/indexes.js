import {
  REQUESTS_COLLECTION,
  TASKS_COLLECTION,
  JOURNEY_PERIODS_COLLECTION,
  SPECIFICATION_COLLECTION,
  NOTES_COLLECTION,
  TASK_NOTES_COLLECTION,
} from "./constants.js";

export async function ensureIndexes(db) {
  await db
    .collection(REQUESTS_COLLECTION)
    .createIndex({ workspaceId: 1, clientCode: 1 });
  await db
    .collection(TASKS_COLLECTION)
    .createIndex(
      { requestId: 1, code: 1 },
      { collation: { locale: "en", strength: 2 } },
    );
  await Promise.all([
    db.collection(REQUESTS_COLLECTION).createIndex({ updatedAt: -1 }),
    db
      .collection(REQUESTS_COLLECTION)
      .createIndex({ listRank: -1, updatedAt: -1, createdAt: -1 }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      listRank: -1,
      updatedAt: -1,
      createdAt: -1,
    }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      updatedAt: -1,
      _id: 1,
    }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      collectionId: 1,
      listRank: -1,
    }),
    db.collection(REQUESTS_COLLECTION).createIndex({
      workspaceId: 1,
      applicationId: 1,
      affectedComponentIds: 1,
    }),
    db
      .collection(JOURNEY_PERIODS_COLLECTION)
      .createIndex({ requestId: 1, month: 1 }, { unique: true }),
    db
      .collection(SPECIFICATION_COLLECTION)
      .createIndex({ requestId: 1 }, { unique: true }),
    db
      .collection(NOTES_COLLECTION)
      .createIndex({ requestId: 1, date: -1, createdAt: -1 }),
    db
      .collection(TASKS_COLLECTION)
      .createIndex({ requestId: 1, createdAt: -1 }),
    db
      .collection(TASK_NOTES_COLLECTION)
      .createIndex({ requestId: 1, taskId: 1, date: -1, createdAt: -1 }),
    db.collection(NOTES_COLLECTION).createIndex(
      { requestId: 1, legacySource: 1 },
      {
        unique: true,
        partialFilterExpression: { legacySource: { $exists: true } },
      },
    ),
  ]);
}
