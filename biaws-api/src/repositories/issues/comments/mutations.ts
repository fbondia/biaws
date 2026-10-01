import type { RepositoryQuery } from "../../../types/http.js";
import { ensureIndexes } from "../indexes.js";
import { ensureIssueExists, createHttpError } from "../support.js";
import { normalizeCommentPayload, hashComment, commentObjectId } from "./normalization.js";
import { COMMENTS_COLLECTION, ISSUES_COLLECTION } from "../constants.js";
import { getIssue } from "../queries.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

export async function createIssueComment(
  issueId: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  issueId = (await ensureIssueExists(db, issueId, query)).id;

  const comment = normalizeCommentPayload(payload);
  const now = new Date();
  const lastComment = await db
    .collection(COMMENTS_COLLECTION)
    .find({ issueId })
    .project({ index: 1 })
    .sort({ index: -1 })
    .limit(1)
    .next();

  const insertResult = await db.collection(COMMENTS_COLLECTION).insertOne({
    issueId,
    hash: hashComment(issueId, comment.text, comment.date),
    text: comment.text,
    from: payload.createdBy || "biaws-api",
    to: [],
    cc: [],
    date: comment.date,
    rawDate: comment.date?.toISOString() ?? "",
    index: Number(lastComment?.index ?? -1) + 1,
    source: { kind: "api" },
    createdAt: now,
    createdBy: payload.createdBy || "biaws-api",
    updatedAt: now,
    updatedBy: payload.createdBy || "biaws-api",
  });
  await db.collection(ISSUES_COLLECTION).updateOne(
    { id: issueId },
    {
      $set: {
        updatedAt: now,
        updatedBy: payload.createdBy || "biaws-api",
      },
    },
  );

  return {
    ...(await getIssue(issueId, query)),
    createdCommentId: insertResult.insertedId.toString(),
  };
}

export async function updateIssueComment(
  issueId: string | string[],
  commentId: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  issueId = (await ensureIssueExists(db, issueId, query)).id;

  const filter = { _id: commentObjectId(String(commentId)), issueId };
  const existing = await db.collection(COMMENTS_COLLECTION).findOne(filter, { projection: { date: 1, source: 1 } });
  if (!existing) {
    throw createHttpError(404, `Issue comment not found: ${commentId}`);
  }
  const comment = normalizeCommentPayload(payload, existing.date ?? null);
  const now = new Date();
  const result = await db.collection(COMMENTS_COLLECTION).updateOne(filter, {
    $set: {
      text: comment.text,
      ...(payload.date !== undefined ? { date: comment.date } : {}),
      ...(payload.date !== undefined && existing.source?.kind === "api"
        ? { rawDate: comment.date?.toISOString() ?? "" }
        : {}),
      hash: hashComment(issueId, comment.text, comment.date),
      updatedAt: now,
      updatedBy: payload.updatedBy || "biaws-api",
    },
  });
  if (!result.matchedCount) {
    throw createHttpError(404, `Issue comment not found: ${commentId}`);
  }
  await db.collection(ISSUES_COLLECTION).updateOne(
    { id: issueId },
    {
      $set: {
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-api",
      },
    },
  );

  return getIssue(issueId, query);
}

export async function deleteIssueComment(
  issueId: string | string[],
  commentId: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  await ensureIndexes(db);
  issueId = (await ensureIssueExists(db, issueId, query)).id;

  const result = await db.collection(COMMENTS_COLLECTION).deleteOne({
    _id: commentObjectId(String(commentId)),
    issueId,
  });
  if (!result.deletedCount) {
    throw createHttpError(404, `Issue comment not found: ${commentId}`);
  }

  const now = new Date();
  await db.collection(ISSUES_COLLECTION).updateOne(
    { id: issueId },
    {
      $set: {
        updatedAt: now,
        updatedBy: payload.deletedBy || "biaws-api",
      },
    },
  );

  return {
    ...(await getIssue(issueId, query)),
    deletedCommentId: String(commentId),
  };
}
