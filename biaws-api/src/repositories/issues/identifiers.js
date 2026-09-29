import { createHttpError } from "./support.js";
import { ISSUES_COLLECTION } from "./constants.js";

export function parseIssueDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(
      422,
      `Invalid issue payload: date must be a valid date`,
    );
  }
  return date;
}

function formatDateLabel(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function generateIssueId(db, date = new Date()) {
  const prefix = `${formatDateLabel(date)}-`;
  const existing = await db
    .collection(ISSUES_COLLECTION)
    .find({ id: { $regex: `^${prefix}\\d{3}$` } })
    .project({ id: 1 })
    .sort({ id: -1 })
    .limit(1)
    .toArray();
  const lastId = existing[0]?.id || "";
  const lastSeq = Number(lastId.slice(prefix.length)) || 0;

  return `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;
}

export function normalizeIssueIdentifier(value) {
  const identifier = String(value || "").trim();
  if (identifier.length > 100 || /[\s/\\]/u.test(identifier)) {
    throw createHttpError(
      422,
      "Issue identifier must contain at most 100 characters without whitespace or slashes",
    );
  }
  return identifier || null;
}
