import {
  CATALOG_KEY_PATTERN,
  CATALOG_LIMITS,
} from "../../../../shared/index.js";

export function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function actorId(actor) {
  return String(actor?.userId || actor?.email || "system").trim();
}

export function requiredText(value, field, limit) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} is required`,
    );
  }
  if (normalized.length > limit) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must contain at most ${limit} characters`,
    );
  }
  return normalized;
}

export function optionalText(value, field, limit) {
  const normalized = String(value || "").trim();
  if (normalized.length > limit) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must contain at most ${limit} characters`,
    );
  }
  return normalized;
}

export function normalizeDocument(document) {
  if (!document) return null;
  const { _id, ...value } = document;
  return value;
}

export function duplicateApplicationError(error) {
  if (error?.code !== 11000) throw error;
  throw createHttpError(
    409,
    "APPLICATION_KEY_CONFLICT",
    "An application with this key already exists in the workspace",
  );
}

export function normalizeKey(value) {
  const key = requiredText(value, "key", CATALOG_LIMITS.key).toLowerCase();
  if (!CATALOG_KEY_PATTERN.test(key)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_KEY",
      "key must use lowercase letters, numbers and single hyphens",
    );
  }
  return key;
}
