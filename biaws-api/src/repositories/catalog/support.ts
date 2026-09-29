import { textValue } from "../../helpers/text.js";
import type { Actor } from "../../types/http.js";
import { CATALOG_KEY_PATTERN, CATALOG_LIMITS } from "../../../../shared/index.js";

export function createHttpError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function actorId(actor: Partial<Actor>) {
  return String(actor?.userId || actor?.email || "system").trim();
}

export function requiredText(value: unknown, field: string, limit: number) {
  const normalized = textValue(value || "").trim();
  if (!normalized) {
    throw createHttpError(422, "INVALID_CATALOG_PAYLOAD", `${field} is required`);
  }
  if (normalized.length > limit) {
    throw createHttpError(422, "INVALID_CATALOG_PAYLOAD", `${field} must contain at most ${limit} characters`);
  }
  return normalized;
}

export function optionalText(value: unknown, field: string, limit: number) {
  const normalized = textValue(value || "").trim();
  if (normalized.length > limit) {
    throw createHttpError(422, "INVALID_CATALOG_PAYLOAD", `${field} must contain at most ${limit} characters`);
  }
  return normalized;
}

export { normalizeDocument } from "../shared/topology/normalization.js";

export function duplicateApplicationError(error: unknown) {
  if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
  throw createHttpError(
    409,
    "APPLICATION_KEY_CONFLICT",
    "An application with this key already exists in the workspace",
  );
}

export function normalizeKey(value: unknown) {
  const key = requiredText(value, "key", CATALOG_LIMITS.key).toLowerCase();
  if (!CATALOG_KEY_PATTERN.test(key)) {
    throw createHttpError(422, "INVALID_CATALOG_KEY", "key must use lowercase letters, numbers and single hyphens");
  }
  return key;
}
