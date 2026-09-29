import { textValue } from "../../../helpers/text.js";
type MetadataValue = string | number | boolean | null | MetadataValue[];
import { createCatalogError } from "./errors.js";
import { PROHIBITED_METADATA_KEY } from "./constants.js";
import { CATALOG_KEY_PATTERN, CATALOG_LIMITS, CATALOG_METADATA_KEY_PATTERN } from "../../../../../shared/index.js";

export function normalizeDocument<T extends object>(document: T): Omit<T, "_id">;
export function normalizeDocument<T extends object>(document: T | null | undefined): Omit<T, "_id"> | null;
export function normalizeDocument<T extends object>(document: T | null | undefined) {
  if (!document) return null;
  const { _id, ...value } = document as T & { _id?: unknown };
  return value;
}

export function assertAllowedFields(
  payload: unknown,
  allowedFields: readonly string[],
  entity: string,
): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${entity} payload must be an object`);
  }
  const unknown = Object.keys(payload).filter((field: string) => !allowedFields.includes(field));
  if (unknown.length) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `unknown ${entity} fields: ${unknown.join(", ")}`);
  }
}

export function requiredText(value: unknown, field: string, limit: number = CATALOG_LIMITS.name) {
  const normalized = textValue(value ?? "").trim();
  if (!normalized) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${field} is required`);
  }
  if (normalized.length > limit) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${field} must contain at most ${limit} characters`);
  }
  return normalized;
}

export function optionalText(value: unknown, field: string, limit: number = CATALOG_LIMITS.description) {
  if (value === undefined || value === null) return "";
  const normalized = textValue(value).trim();
  if (normalized.length > limit) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${field} must contain at most ${limit} characters`);
  }
  return normalized;
}

export function normalizeKey(value: unknown, currentKey?: unknown) {
  const key = requiredText(value ?? currentKey, "key", CATALOG_LIMITS.key).toLowerCase();
  if (!CATALOG_KEY_PATTERN.test(key)) {
    throw createCatalogError(422, "INVALID_CATALOG_KEY", "key must use lowercase letters, numbers and single hyphens");
  }
  return key;
}

export function normalizeEnum(value: unknown, field: string, allowed: readonly string[], fallback?: string) {
  const normalized = textValue(value ?? fallback ?? "").trim();
  if (!allowed.includes(normalized)) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${field} must be one of: ${allowed.join(", ")}`);
  }
  return normalized;
}

export function normalizeTags(value: unknown, current: string[] = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > CATALOG_LIMITS.tags) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `tags must be an array with at most ${CATALOG_LIMITS.tags} items`,
    );
  }
  const unique = new Map<string, string>();
  value.forEach((tag, index: number) => {
    const normalized = requiredText(tag, `tags[${index}]`, CATALOG_LIMITS.tag);
    const identity = normalized.toLocaleLowerCase("pt-BR");
    if (!unique.has(identity)) unique.set(identity, normalized);
  });
  return [...unique.values()];
}

export function normalizeStringArray(
  value: unknown,
  field: string,
  {
    limit = 25,
    itemLimit = CATALOG_LIMITS.address,
    current = [],
  }: { limit?: number; itemLimit?: number; current?: string[] } = {},
) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > limit) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${field} must be an array with at most ${limit} items`);
  }
  return [...new Set(value.map((item, index: number) => requiredText(item, `${field}[${index}]`, itemLimit)))];
}

export function normalizeHttpUrl(
  value: unknown,
  field: string,
  { required = false, current = "" }: { required?: boolean; current?: unknown } = {},
) {
  const raw = required
    ? requiredText(value ?? current, field, CATALOG_LIMITS.linkUrl)
    : optionalText(value ?? current, field, CATALOG_LIMITS.linkUrl);
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw createCatalogError(422, "INVALID_CATALOG_URL", `${field} must be a valid URL`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw createCatalogError(422, "INVALID_CATALOG_URL", `${field} must use HTTP(S)`);
  }
  assertCredentialFreeUrl(url, field);
  return url.toString();
}

export function assertCredentialFreeUrl(url: URL, field: string) {
  const sensitiveQueryParameter = [...url.searchParams.keys()].find((key: string) => PROHIBITED_METADATA_KEY.test(key));
  if (url.username || url.password || sensitiveQueryParameter || PROHIBITED_METADATA_KEY.test(url.hash)) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_URL",
      `${field} cannot contain embedded credentials or secret parameters`,
    );
  }
}

export function normalizeDate(value: unknown, field: string, current: Date | null = null) {
  if (value === undefined) return current ?? null;
  if (value === null || value === "") return null;
  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", `${field} must be a valid ISO date`);
  }
  return date;
}

export function normalizeOptionalPort(value: unknown, current: number | null | undefined = null) {
  if (value === undefined) return current ?? null;
  if (value === null || value === "") return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw createCatalogError(422, "INVALID_CATALOG_PAYLOAD", "port must be an integer between 1 and 65535");
  }
  return port;
}

function normalizeMetadataValue(value: unknown, field: string): MetadataValue {
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
    return value;
  }
  if (typeof value === "string") {
    return optionalText(value, field, CATALOG_LIMITS.metadataString);
  }
  if (Array.isArray(value)) {
    if (value.length > CATALOG_LIMITS.metadataArrayItems) {
      throw createCatalogError(
        422,
        "INVALID_RUNTIME_METADATA",
        `${field} must contain at most ${CATALOG_LIMITS.metadataArrayItems} items`,
      );
    }
    return value.map((item, index: number) => {
      if (item !== null && typeof item === "object") {
        throw createCatalogError(422, "INVALID_RUNTIME_METADATA", `${field}[${index}] must be a scalar`);
      }
      return normalizeMetadataValue(item, `${field}[${index}]`);
    });
  }
  throw createCatalogError(422, "INVALID_RUNTIME_METADATA", `${field} must be a scalar or an array of scalars`);
}

export function normalizeMetadata(value: unknown, current: Record<string, MetadataValue> = {}) {
  if (value === undefined) return current;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createCatalogError(422, "INVALID_RUNTIME_METADATA", "metadata must be an object");
  }
  const entries = Object.entries(value);
  if (entries.length > CATALOG_LIMITS.metadataEntries) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_METADATA",
      `metadata must contain at most ${CATALOG_LIMITS.metadataEntries} entries`,
    );
  }
  const normalized: Record<string, MetadataValue> = {};
  for (const [key, entry] of entries) {
    if (!CATALOG_METADATA_KEY_PATTERN.test(key) || PROHIBITED_METADATA_KEY.test(key)) {
      throw createCatalogError(422, "INVALID_RUNTIME_METADATA", `metadata key is invalid or prohibited: ${key}`);
    }
    normalized[key] = normalizeMetadataValue(entry, `metadata.${key}`);
  }
  if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > CATALOG_LIMITS.metadataBytes) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_METADATA",
      `metadata must contain at most ${CATALOG_LIMITS.metadataBytes} bytes`,
    );
  }
  return normalized;
}
