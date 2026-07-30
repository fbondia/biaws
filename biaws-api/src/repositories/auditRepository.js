import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

const AUDIT_COLLECTION = COLLECTION_NAMES.AUDIT_EVENTS;
const MAX_STRING_LENGTH = 4_000;
const MAX_ARRAY_LENGTH = 50;
const IGNORED_FIELDS = new Set([
  "_id",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "contentBase64",
  "password",
  "token",
]);

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
      .filter(([key]) => !IGNORED_FIELDS.has(key))
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

export function buildAuditFilter(rootType, rootId) {
  return {
    $or: [
      { rootType, rootId: String(rootId) },
      { "target.type": rootType, "target.id": String(rootId) },
    ],
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

async function auditCollection() {
  const db = await getMongoDatabase();
  const collection = db.collection(AUDIT_COLLECTION);
  await Promise.all([
    collection.createIndex({ rootType: 1, rootId: 1, occurredAt: -1 }),
    collection.createIndex({
      "target.type": 1,
      "target.id": 1,
      occurredAt: -1,
    }),
    collection.createIndex({ "actor.userId": 1, occurredAt: -1 }),
    collection.createIndex({ occurredAt: -1 }),
  ]);
  return collection;
}

export async function recordAuditEvent({
  actor,
  action,
  target,
  root = target,
  before = null,
  after = null,
  summary = "",
  metadata = {},
}) {
  const document = buildAuditEvent({
    actor,
    action,
    target,
    root,
    before,
    after,
    summary,
    metadata,
  });
  const collection = await auditCollection();
  const result = await collection.insertOne(document);
  return { ...document, id: result.insertedId.toString() };
}

export async function listAuditEvents(
  rootType,
  rootId,
  { authorizationScope, limit = 100 } = {},
) {
  const collection = await auditCollection();
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const filter = buildAuditFilter(rootType, rootId);
  if (authorizationScope?.workspaceId) {
    filter["metadata.workspaceId"] = authorizationScope.workspaceId;
  }
  if (authorizationScope && authorizationScope.workspace !== true) {
    filter["metadata.applicationId"] = {
      $in: (authorizationScope.applicationIds || []).map(String),
    };
  }
  const events = await collection
    .find(filter)
    .sort({ occurredAt: -1, _id: -1 })
    .limit(safeLimit)
    .toArray();
  return events.map(({ _id, ...event }) => ({ ...event, id: _id.toString() }));
}
