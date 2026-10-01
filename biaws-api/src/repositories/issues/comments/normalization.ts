import { textValue } from "../../../helpers/text.js";
import { createHttpError } from "../support.js";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { ObjectIdLike } from "bson";

export function hashComment(issueId: string, text: string, date: Date | null) {
  return crypto
    .createHash("sha256")
    .update(`${issueId}\n${date?.toISOString() ?? ""}\n${text}`)
    .digest("hex");
}

export function normalizeCommentPayload(payload: Record<string, unknown> = {}, fallbackDate: Date | null = new Date()) {
  const text = textValue(payload.text || "").trim();
  if (!text) {
    throw createHttpError(422, "Invalid issue comment payload: text is required");
  }

  if (payload.date === undefined) return { text, date: fallbackDate };
  if (payload.date === null) return { text, date: null };
  const value = payload.date;
  if (
    (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) ||
    (typeof value === "string" && !value.trim())
  ) {
    throw createHttpError(422, "Invalid issue comment payload: date must be a valid date or null");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(422, "Invalid issue comment payload: date must be a valid date or null");
  }
  return { text, date };
}

export function commentObjectId(commentId: string | Uint8Array<ArrayBufferLike> | ObjectId | ObjectIdLike) {
  if (!ObjectId.isValid(commentId)) {
    throw createHttpError(404, "Issue comment not found");
  }
  return new ObjectId(commentId);
}
