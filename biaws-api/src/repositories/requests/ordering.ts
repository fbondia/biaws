import type { Db, Document } from "mongodb";
import type { RepositoryQuery } from "../../types/http.js";
import type { RequestDocument } from "../../types/requests.js";
import { REQUESTS_COLLECTION, LIST_RANK_STEP } from "./constants.js";
import { requestReferenceId, requestFilter } from "./references.js";
import { createHttpError } from "./support.js";

function dateRank(value: string | number | Date | null | undefined) {
  const date = value instanceof Date ? value : new Date(value || 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

export function requestListRank(document: Document | null) {
  const rank = Number(document?.listRank);
  return Number.isFinite(rank) ? rank : dateRank(document?.updatedAt || document?.createdAt);
}

export async function ensureRequestListRanks(db: Db) {
  const requestsWithoutRank = await db
    .collection(REQUESTS_COLLECTION)
    .find({ listRank: { $exists: false } })
    .project({ _id: 1, updatedAt: 1, createdAt: 1 })
    .toArray();

  if (!requestsWithoutRank.length) return;

  await db.collection(REQUESTS_COLLECTION).bulkWrite(
    requestsWithoutRank.map((request) => ({
      updateOne: {
        filter: { _id: request._id },
        update: {
          $set: {
            listRank: requestListRank(request),
          },
        },
      },
    })),
  );
}

export async function nextTopListRank(db: Db) {
  const topRequest = await db
    .collection(REQUESTS_COLLECTION)
    .find({})
    .sort({ listRank: -1, updatedAt: -1, createdAt: -1 })
    .project({ listRank: 1, updatedAt: 1, createdAt: 1 })
    .limit(1)
    .next();
  const topRank = requestListRank(topRequest);

  return Math.max(Date.now(), topRank + LIST_RANK_STEP);
}

export async function readListRankNeighbor(
  db: Db,
  requestIdValue: unknown,
  fieldName: string,
  collectionId: string,
  query: RepositoryQuery = {},
) {
  if (!requestIdValue) return null;

  const requestId = await requestReferenceId(db, requestIdValue, query);
  const request = await db.collection<RequestDocument>(REQUESTS_COLLECTION).findOne(
    {
      ...requestFilter(requestId, query),
      collectionId: collectionId || { $in: ["", null] },
    },
    {
      projection: { listRank: 1, updatedAt: 1, createdAt: 1 },
    },
  );

  if (!request) {
    throw createHttpError(422, `Invalid request payload: ${fieldName} request not found`);
  }

  return requestListRank(request);
}

export function calculateMovedListRank(previousRank: number | null, nextRank: number | null) {
  if (previousRank !== null && Number.isFinite(previousRank) && nextRank !== null && Number.isFinite(nextRank)) {
    if (previousRank > nextRank) return (previousRank + nextRank) / 2;
    return previousRank + LIST_RANK_STEP;
  }

  if (nextRank !== null && Number.isFinite(nextRank)) return nextRank + LIST_RANK_STEP;
  if (previousRank !== null && Number.isFinite(previousRank)) return previousRank - LIST_RANK_STEP;

  return Date.now();
}
