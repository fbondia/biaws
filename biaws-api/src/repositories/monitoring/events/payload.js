import {
  PAYLOAD_LIMITS,
  PAYLOAD_KEY_PATTERN,
  PROHIBITED_PAYLOAD_KEY,
} from "./constants.js";
import { createCatalogError } from "../../shared/topology/errors.js";

function assertMonitoringPayloadTraversal(state, depth) {
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

function normalizeMonitoringPayloadString(entry, field) {
  if (entry.length > PAYLOAD_LIMITS.string) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `${field} must contain at most ${PAYLOAD_LIMITS.string} characters`,
    );
  }
  return entry;
}

function normalizeMonitoringPayloadArray(entry, field, depth, state) {
  if (entry.length > PAYLOAD_LIMITS.arrayItems) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_PAYLOAD",
      `${field} must contain at most ${PAYLOAD_LIMITS.arrayItems} items`,
    );
  }
  return entry.map((item, index) =>
    normalizeMonitoringPayloadEntry(
      item,
      `${field}[${index}]`,
      depth + 1,
      state,
    ),
  );
}

function assertMonitoringPayloadKey(key) {
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

function normalizeMonitoringPayloadObject(entry, field, depth, state) {
  const normalized = {};
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

function normalizeMonitoringPayloadEntry(entry, field, depth, state) {
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

export function normalizeMonitoringPayload(value) {
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
