import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export const AUDIT_COLLECTION = COLLECTION_NAMES.AUDIT_EVENTS;

export const MAX_STRING_LENGTH = 4_000;

export const MAX_ARRAY_LENGTH = 50;

export const IGNORED_FIELDS = new Set([
  "_id",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "contentBase64",
  "password",
  "token",
]);

const SECRET_FIELD_PATTERNS = [
  /password|passwd|pwd|secret(?:value)?|token|credential|authorization|ciphertext/iu,
  /api[-_.]?key|private[-_.]?key|connection[-_.]?string/iu,
  /auth[-_.]?tag|encrypted[-_.]?data[-_.]?key/iu,
];
export const SECRET_FIELD_PATTERN = {
  test: (key: string) => SECRET_FIELD_PATTERNS.some((pattern) => pattern.test(key)),
};
