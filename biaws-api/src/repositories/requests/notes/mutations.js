import { ensureIndexes } from "../indexes.js";
import { ensureRequestListRanks } from "../ordering.js";
import {
  requestReferenceId,
  ensureRequestExists,
  touchRequest,
  requestNoteObjectId,
} from "../references.js";
import { normalizeNotePayload } from "./normalization.js";
import { NOTES_COLLECTION, REQUESTS_COLLECTION } from "../constants.js";
import { readRequestById } from "../queries.js";
import { createHttpError } from "../support.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

export async function createRequestNote(
  requestIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const note = normalizeNotePayload(payload);
  const now = new Date();

  await db.collection(NOTES_COLLECTION).insertOne({
    requestId,
    date: note.date,
    content: note.content,
    createdAt: now,
    updatedAt: now,
  });
  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function updateRequestNote(
  requestIdValue,
  noteIdValue,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const note = normalizeNotePayload(payload);
  const now = new Date();
  const result = await db.collection(NOTES_COLLECTION).updateOne(
    { _id: noteId, requestId },
    {
      $set: {
        date: note.date,
        content: note.content,
        updatedAt: now,
      },
    },
  );

  if (!result.matchedCount) {
    throw createHttpError(404, `Request note not found: ${noteIdValue}`);
  }

  await touchRequest(db, requestId, now);

  return {
    request: await readRequestById(db, requestId, query),
  };
}

export async function deleteRequestNote(
  requestIdValue,
  noteIdValue,
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  await ensureRequestListRanks(db);

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const noteId = requestNoteObjectId(noteIdValue);
  await ensureRequestExists(db, requestId, requestIdValue, query);

  const note = await db
    .collection(NOTES_COLLECTION)
    .findOne({ _id: noteId, requestId }, { projection: { legacySource: 1 } });
  const result = await db
    .collection(NOTES_COLLECTION)
    .deleteOne({ _id: noteId, requestId });

  if (!result.deletedCount) {
    throw createHttpError(404, `Request note not found: ${noteIdValue}`);
  }

  const now = new Date();
  if (note?.legacySource === "Request.notes") {
    await db.collection(REQUESTS_COLLECTION).updateOne(
      { _id: requestId },
      {
        $unset: {
          notes: "",
        },
      },
    );
  }
  await touchRequest(db, requestId, now);

  return {
    deleted: true,
    request: await readRequestById(db, requestId, query),
  };
}
