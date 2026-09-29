import { textValue } from "../../../helpers/text.js";
import { createHttpError } from "../support.js";
import { parseIssueDate } from "../identifiers.js";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { ObjectIdLike } from "bson";

export function hashComment(issueId: string, text: string, date: Date) {
  return crypto.createHash("sha256").update(`${issueId}\n${date.toISOString()}\n${text}`).digest("hex");
}

export function normalizeCommentPayload(payload: Record<string, unknown> = {}) {
  const text = textValue(payload.text || "").trim();
  if (!text) {
    throw createHttpError(422, "Invalid issue comment payload: text is required");
  }

  return {
    text,
    date: parseIssueDate(payload.date),
  };
}

export function commentObjectId(commentId: string | Uint8Array<ArrayBufferLike> | ObjectId | ObjectIdLike) {
  if (!ObjectId.isValid(commentId)) {
    throw createHttpError(404, "Issue comment not found");
  }
  return new ObjectId(commentId);
}
