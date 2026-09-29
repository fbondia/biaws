import type { RepositoryQuery } from "../../types/http.js";
import { getIssue } from "./queries.js";
import {
  required,
  resourceResponse,
  attachmentResourceResponse,
} from "../shared/resourceReads.js";
import { COLLECTION_NAMES as C } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { ObjectId } from "mongodb";
import { getPagination } from "../../helpers/query.js";
import { referenceError } from "../../helpers/referenceLookup.js";
import { ParamsDictionary } from "express-serve-static-core";

export async function readIssueResource(
  id: string | string[],
  part: string,
  params: ParamsDictionary = {},
  query: RepositoryQuery = {},
) {
  let root, value;

  const result = await getIssue(id, { ...query, includeComments: false });
  root = required(result.issue);
  if (part === "comments" || part === "comment") {
    const db = await getMongoDatabase({
      db: query.db,
      database: query.database,
    });
    const comments = db.collection(C.ISSUE_COMMENTS);
    const filter = { issueId: root.id };
    const context = {
      id: root.id,
      workspaceId: root.workspaceId,
      applicationId: root.applicationId,
    };
    if (part === "comment") {
      if (
        typeof params.commentId !== "string" ||
        !ObjectId.isValid(params.commentId)
      )
        throw referenceError(404, "NOT_FOUND", "Comment not found");
      const comment = required(
        await comments.findOne({
          ...filter,
          _id: new ObjectId(params.commentId),
        }),
      );
      return { context, value: { ...comment, _id: String(comment._id) } };
    }
    await comments.createIndex({ issueId: 1, date: -1, _id: -1 });
    const { page, limit, skip } = getPagination(query);
    const [items, total] = await Promise.all([
      comments
        .find(filter)
        .sort({ date: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      comments.countDocuments(filter),
    ]);
    return {
      context,
      items: items.map((item) => ({ ...item, _id: String(item._id) })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
  value = root.classification || {};

  return resourceResponse(root, value, params, query);
}

export async function readIssueAttachmentResource(
  id: string | string[],
  params: ParamsDictionary,
  query: RepositoryQuery = {},
) {
  const root = required(
    (await getIssue(id, { ...query, includeComments: false })).issue,
  );
  return attachmentResourceResponse(
    root,
    root.attachments || [],
    params,
    query,
  );
}
