import { REQUESTS_COLLECTION, TASKS_COLLECTION } from "./constants.js";
import { createHttpError } from "./support.js";
import { findByReference } from "../../helpers/referenceLookup.js";
import { ObjectId } from "mongodb";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

export async function requestReferenceId(db, reference, query) {
  const document = await findByReference(
    db.collection(REQUESTS_COLLECTION),
    reference,
    {
      idField: "_id",
      identifierField: "clientCode",
      filter: buildKnowledgeContextFilter(query),
      projection: { _id: 1 },
    },
  );
  if (!document) throw createHttpError(404, "Request not found");
  return document._id;
}

export async function taskReferenceId(db, reference, requestId) {
  const document = await findByReference(
    db.collection(TASKS_COLLECTION),
    reference,
    {
      idField: "_id",
      identifierField: "code",
      caseInsensitive: true,
      filter: { requestId },
      projection: { _id: 1 },
    },
  );
  if (!document) throw createHttpError(404, "Request task not found");
  return document._id;
}

export function requestNoteObjectId(id) {
  if (!ObjectId.isValid(id)) {
    throw createHttpError(404, `Request note not found: ${id}`);
  }

  return new ObjectId(id);
}

export async function touchRequest(db, requestId, now) {
  await db.collection(REQUESTS_COLLECTION).updateOne(
    { _id: requestId },
    {
      $set: {
        updatedAt: now,
      },
    },
  );
}

export function requestFilter(requestId, query = {}) {
  return { _id: requestId, ...buildKnowledgeContextFilter(query) };
}

export async function ensureRequestExists(
  db,
  requestId,
  requestIdValue,
  query = {},
) {
  const existing = await db
    .collection(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query), { projection: { _id: 1 } });

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }
}
