import {
  PAYLOAD_LIMITS,
  PAYLOAD_KEY_PATTERN,
  PROHIBITED_PAYLOAD_KEY,
} from "./constants.js";
import { createCatalogError } from "../../shared/topology/errors.js";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function assertMonitoringPayloadTraversal(
  state: { nodes: number },
  depth: number,
) {
  state.nodes += 1;
  if (state.nodes > PAYLOAD_LIMITS.nodes) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload must contain at most ${PAYLOAD_LIMITS.nodes} values`,
    );
  }
  if (depth > PAYLOAD_LIMITS.depth) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload must contain at most ${PAYLOAD_LIMITS.depth} nested levels`,
    );
  }
}

function normalizeMonitoringPayloadString(entry: string, field: string) {
  if (entry.length > PAYLOAD_LIMITS.string) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `${field} must contain at most ${PAYLOAD_LIMITS.string} characters`,
    );
  }
  return entry;
}

function normalizeMonitoringPayloadArray(
  entry: unknown[],
  field: string,
  depth: number,
  state: { nodes: number },
): JsonValue[] {
  if (entry.length > PAYLOAD_LIMITS.arrayItems) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `${field} must contain at most ${PAYLOAD_LIMITS.arrayItems} items`,
    );
  }
  return entry.map((item, index: number) =>
    normalizeMonitoringPayloadEntry(
      item,
      `${field}[${index}]`,
      depth + 1,
      state,
    ),
  );
}

function assertMonitoringPayloadKey(key: string) {
  if (
    !PAYLOAD_KEY_PATTERN.test(key) ||
    PROHIBITED_PAYLOAD_KEY.test(key) ||
    ["constructor", "prototype"].includes(key.toLowerCase())
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload key is invalid or prohibited: ${key}`,
    );
  }
}

function normalizeMonitoringPayloadObject(
  entry: object,
  field: string,
  depth: number,
  state: { nodes: number },
): Record<string, JsonValue> {
  const normalized: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(entry)) {
    assertMonitoringPayloadKey(key);
    normalized[key] = normalizeMonitoringPayloadEntry(
      item,
      `${field}.${key}`,
      depth + 1,
      state,
    );
  }
  return normalized;
}

function normalizeMonitoringPayloadEntry(
  entry: unknown,
  field: string,
  depth: number,
  state: { nodes: number },
): JsonValue {
  assertMonitoringPayloadTraversal(state, depth);
  if (
    entry === null ||
    typeof entry === "boolean" ||
    (typeof entry === "number" && Number.isFinite(entry))
  ) {
    return entry;
  }
  if (typeof entry === "string") {
    return normalizeMonitoringPayloadString(entry, field);
  }
  if (Array.isArray(entry)) {
    return normalizeMonitoringPayloadArray(entry, field, depth, state);
  }
  if (entry && typeof entry === "object") {
    return normalizeMonitoringPayloadObject(entry, field, depth, state);
  }
  throw createCatalogError(
    422,
    "INVALID_MONITORING_PAYLOAD",
    `${field} must contain valid JSON values`,
  );
}

export function normalizeMonitoringPayload(value: unknown) {
  if (value === undefined) return null;
  const state = { nodes: 0 };
  const normalized = normalizeMonitoringPayloadEntry(
    value,
    "payload",
    0,
    state,
  );
  if (
    Buffer.byteLength(JSON.stringify(normalized), "utf8") > PAYLOAD_LIMITS.bytes
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `payload must contain at most ${PAYLOAD_LIMITS.bytes} bytes`,
    );
  }
  return normalized;
}
