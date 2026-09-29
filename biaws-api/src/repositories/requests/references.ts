import type { Db, Filter } from "mongodb";
import type { RequestDocument } from "../../types/requests.js";
import type { RepositoryQuery } from "../../types/http.js";
import { REQUESTS_COLLECTION, TASKS_COLLECTION } from "./constants.js";
import { createHttpError } from "./support.js";
import { findByReference } from "../../helpers/referenceLookup.js";
import { ObjectId } from "mongodb";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";
import { ObjectIdLike } from "bson";

export async function requestReferenceId(
  db: Db,
  reference: unknown,
  query: RepositoryQuery,
) {
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

export async function taskReferenceId(
  db: Db,
  reference: unknown,
  requestId: ObjectId,
) {
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

export function requestNoteObjectId(
  id: string | Uint8Array<ArrayBufferLike> | ObjectId | ObjectIdLike,
) {
  if (!ObjectId.isValid(id)) {
    throw createHttpError(404, `Request note not found: ${id}`);
  }

  return new ObjectId(id);
}

export async function touchRequest(db: Db, requestId: ObjectId, now: Date) {
  await db.collection(REQUESTS_COLLECTION).updateOne(
    { _id: requestId },
    {
      $set: {
        updatedAt: now,
      },
    },
  );
}

export function requestFilter(
  requestId: ObjectId,
  query: RepositoryQuery = {},
): Filter<RequestDocument> {
  return {
    _id: requestId,
    ...buildKnowledgeContextFilter(query),
  } as Filter<RequestDocument>;
}

export async function ensureRequestExists(
  db: Db,
  requestId: ObjectId,
  requestIdValue: string | string[],
  query: RepositoryQuery = {},
) {
  const existing = await db
    .collection<RequestDocument>(REQUESTS_COLLECTION)
    .findOne(requestFilter(requestId, query), { projection: { _id: 1 } });

  if (!existing) {
    throw createHttpError(404, `Request not found: ${requestIdValue}`);
  }
}
