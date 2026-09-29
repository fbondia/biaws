import { createHttpError } from "../support.js";
import { parseIssueDate } from "../identifiers.js";
import crypto from "crypto";
import { ObjectId } from "mongodb";

export function hashComment(issueId, text, date) {
  return crypto
    .createHash("sha256")
    .update(`${issueId}\n${date.toISOString()}\n${text}`)
    .digest("hex");
}

export function normalizeCommentPayload(payload = {}) {
  const text = String(payload.text || "").trim();
  if (!text) {
    throw createHttpError(
      422,
      "Invalid issue comment payload: text is required",
    );
  }

  return {
    text,
    date: parseIssueDate(payload.date),
  };
}

export function commentObjectId(commentId) {
  if (!ObjectId.isValid(commentId)) {
    throw createHttpError(404, `Issue comment not found: ${commentId}`);
  }
  return new ObjectId(commentId);
}
