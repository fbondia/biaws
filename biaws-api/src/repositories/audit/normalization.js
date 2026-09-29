import {
  MAX_STRING_LENGTH,
  MAX_ARRAY_LENGTH,
  IGNORED_FIELDS,
  SECRET_FIELD_PATTERN,
} from "./constants.js";

function normalizeScalar(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (value && typeof value.toHexString === "function")
    return value.toHexString();
  return value;
}

export function sanitizeAuditValue(value, depth = 0) {
  if (value === null || value === undefined || typeof value !== "object") {
    return normalizeScalar(value);
  }
  if (depth >= 6) return "[depth-limit]";
  if (Array.isArray(value)) {
    const entries = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeAuditValue(entry, depth + 1));
    if (value.length > MAX_ARRAY_LENGTH)
      entries.push(`[+${value.length - MAX_ARRAY_LENGTH} items]`);
    return entries;
  }
  if (value instanceof Date || typeof value.toHexString === "function") {
    return normalizeScalar(value);
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) => !IGNORED_FIELDS.has(key) && !SECRET_FIELD_PATTERN.test(key),
      )
      .map(([key, entry]) => [key, sanitizeAuditValue(entry, depth + 1)]),
  );
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function calculateAuditChanges(before, after, prefix = "") {
  const safeBefore = sanitizeAuditValue(before);
  const safeAfter = sanitizeAuditValue(after);
  if (sameValue(safeBefore, safeAfter)) return [];

  const beforeObject =
    safeBefore && typeof safeBefore === "object" && !Array.isArray(safeBefore);
  const afterObject =
    safeAfter && typeof safeAfter === "object" && !Array.isArray(safeAfter);
  if ((safeBefore === null || safeBefore === undefined) && afterObject) {
    return calculateAuditChanges({}, safeAfter, prefix);
  }
  if (beforeObject && (safeAfter === null || safeAfter === undefined)) {
    return calculateAuditChanges(safeBefore, {}, prefix);
  }
  if (!beforeObject || !afterObject) {
    return [
      {
        field: prefix || "value",
        before: safeBefore ?? null,
        after: safeAfter ?? null,
      },
    ];
  }

  const keys = [
    ...new Set([...Object.keys(safeBefore), ...Object.keys(safeAfter)]),
  ].sort((left, right) => left.localeCompare(right));
  return keys.flatMap((key) => {
    if (IGNORED_FIELDS.has(key)) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    return calculateAuditChanges(safeBefore[key], safeAfter[key], path);
  });
}

function normalizeActor(actor = {}) {
  return {
    userId: actor.userId,
    displayName: actor.displayName || "",
    email: actor.email || "",
    authenticationMethod: actor.authenticationMethod || "",
  };
}

export function buildAuditEvent({
  actor,
  action,
  target,
  root = target,
  before = null,
  after = null,
  summary = "",
  metadata = {},
  occurredAt = new Date(),
}) {
  return {
    actor: normalizeActor(actor),
    action,
    target: {
      type: target.type,
      id: String(target.id),
      label: target.label || "",
    },
    rootType: root.type,
    rootId: String(root.id),
    summary,
    changes: calculateAuditChanges(before, after),
    metadata: sanitizeAuditValue(metadata),
    occurredAt,
  };
}
