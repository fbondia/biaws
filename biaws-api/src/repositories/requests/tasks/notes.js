import { ensureIndexes } from "../indexes.js";
import {
  requestReferenceId,
  taskReferenceId,
  ensureRequestExists,
  touchRequest,
  requestNoteObjectId,
} from "../references.js";
import { TASKS_COLLECTION, TASK_NOTES_COLLECTION } from "../constants.js";
import { createHttpError } from "../support.js";
import { normalizeNotePayload } from "../notes/normalization.js";
import { readRequestById } from "../queries.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

export async function createRequestTaskNote(
  requestIdValue,
  taskIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const taskId = await taskReferenceId(db, taskIdValue, requestId);
  await ensureRequestExists(db, requestId, requestIdValue, query);
  const task = await db
    .collection(TASKS_COLLECTION)
    .findOne({ _id: taskId, requestId }, { projection: { _id: 1 } });
  if (!task)
    throw createHttpError(404, `Request task not found: ${taskIdValue}`);

  const note = normalizeNotePayload(payload);
  const now = new Date();
  await db.collection(TASK_NOTES_COLLECTION).insertOne({
    requestId,
    taskId,
    date: note.date,
    content: note.content,
    createdAt: now,
    updatedAt: now,
  });
  await touchRequest(db, requestId, now);

  return { request: await readRequestById(db, requestId, query) };
}

export async function updateRequestTaskNote(
  requestIdValue,
  taskIdValue,
  noteIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const taskId = await taskReferenceId(db, taskIdValue, requestId);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);
  const note = normalizeNotePayload(payload);
  const now = new Date();
  const result = await db
    .collection(TASK_NOTES_COLLECTION)
    .updateOne(
      { _id: noteId, requestId, taskId },
      { $set: { date: note.date, content: note.content, updatedAt: now } },
    );
  if (!result.matchedCount)
    throw createHttpError(404, `Request task note not found: ${noteIdValue}`);
  await touchRequest(db, requestId, now);

  return { request: await readRequestById(db, requestId, query) };
}

export async function deleteRequestTaskNote(
  requestIdValue,
  taskIdValue,
  noteIdValue,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const taskId = await taskReferenceId(db, taskIdValue, requestId);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);
  const result = await db
    .collection(TASK_NOTES_COLLECTION)
    .deleteOne({ _id: noteId, requestId, taskId });
  if (!result.deletedCount)
    throw createHttpError(404, `Request task note not found: ${noteIdValue}`);
  const now = new Date();
  await touchRequest(db, requestId, now);

  return {
    deleted: true,
    request: await readRequestById(db, requestId, query),
  };
}
