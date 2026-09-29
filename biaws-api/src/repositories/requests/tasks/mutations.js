import { loadRequestOptions } from "../options.js";
import { ensureIndexes } from "../indexes.js";
import {
  requestReferenceId,
  ensureRequestExists,
  touchRequest,
  taskReferenceId,
} from "../references.js";
import { normalizeTaskPayload } from "./normalization.js";
import {
  TASKS_COLLECTION,
  REQUESTS_COLLECTION,
  TASK_NOTES_COLLECTION,
} from "../constants.js";
import { readRequestById } from "../queries.js";
import { createHttpError } from "../support.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

export async function createRequestTask(
  requestIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const task = normalizeTaskPayload(payload);
  const now = new Date();
  await db.collection(TASKS_COLLECTION).insertOne({
    requestId,
    ...task,
    createdAt: now,
    updatedAt: now,
  });
  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function updateRequestTask(
  requestIdValue,
  taskIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await loadRequestOptions(db, query);
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const taskId = await taskReferenceId(db, taskIdValue, requestId);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const existing = await db
    .collection(TASKS_COLLECTION)
    .findOne({ _id: taskId, requestId });
  if (!existing) {
    throw createHttpError(404, `Request task not found: ${taskIdValue}`);
  }

  const task = normalizeTaskPayload(
    { ...existing, ...payload },
    existing.status,
  );
  const now = new Date();
  await db.collection(TASKS_COLLECTION).updateOne(
    { _id: taskId, requestId },
    {
      $set: {
        ...task,
        updatedAt: now,
      },
    },
  );
  const previousCode = String(existing.code || "")
    .trim()
    .toLowerCase();
  const nextCode = String(task.code || "")
    .trim()
    .toLowerCase();
  if (previousCode && previousCode !== nextCode) {
    const request = await db
      .collection(REQUESTS_COLLECTION)
      .findOne({ _id: requestId }, { projection: { attachments: 1 } });
    const attachments = (request?.attachments || []).map((attachment) => ({
      ...attachment,
      tags: [
        ...new Set(
          (attachment.tags || []).map((tag) =>
            String(tag).trim().toLowerCase() === previousCode ? nextCode : tag,
          ),
        ),
      ].filter(Boolean),
    }));
    await db
      .collection(REQUESTS_COLLECTION)
      .updateOne({ _id: requestId }, { $set: { attachments } });
  }
  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function deleteRequestTask(
  requestIdValue,
  taskIdValue,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const taskId = await taskReferenceId(db, taskIdValue, requestId);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const result = await db
    .collection(TASKS_COLLECTION)
    .deleteOne({ _id: taskId, requestId });
  if (!result.deletedCount) {
    throw createHttpError(404, `Request task not found: ${taskIdValue}`);
  }

  await db.collection(TASK_NOTES_COLLECTION).deleteMany({ requestId, taskId });

  const now = new Date();
  await touchRequest(db, requestId, now);

  return {
    deleted: true,
    request: await readRequestById(db, requestId, query),
  };
}
