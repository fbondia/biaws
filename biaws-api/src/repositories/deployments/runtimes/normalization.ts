import type { RuntimeFields } from "../../../types/topology.js";
import type { Actor } from "../../../types/http.js";
import {
  MAX_RUNTIME_DOCUMENTS,
  RUNTIME_DOCUMENT_PURPOSES,
  MUTABLE_RUNTIME_STATUSES,
  MAX_OPERATIONAL_NOTES_LENGTH,
} from "../constants.js";
import { CATALOG_LIMITS, DEFAULT_MONITORING_RETENTION_DAYS, RUNTIME_KINDS } from "../../../../../shared/index.js";
import {
  assertAllowedFields,
  normalizeDate,
  normalizeEnum,
  normalizeHttpUrl,
  normalizeKey,
  normalizeMetadata,
  normalizeOptionalPort,
  optionalText,
  requiredText,
} from "../../shared/topology/normalization.js";
import { createCatalogError } from "../../shared/topology/errors.js";

function normalizeDocumentLinks(value: unknown, current: RuntimeFields["documentLinks"] = []) {
  if (value === undefined) return [...(current || [])];
  if (!Array.isArray(value) || value.length > MAX_RUNTIME_DOCUMENTS) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_DOCUMENTS",
      `documentLinks must be an array with at most ${MAX_RUNTIME_DOCUMENTS} items`,
    );
  }
  const seen = new Set();
  return value.map((link, index: number) => {
    if (!link || typeof link !== "object" || Array.isArray(link)) {
      throw createCatalogError(422, "INVALID_RUNTIME_DOCUMENTS", `documentLinks[${index}] must be an object`);
    }
    const documentId = String(link.documentId || "").trim();
    const purpose = String(link.purpose || "reference").trim();
    if (!documentId || seen.has(documentId)) {
      throw createCatalogError(
        422,
        "INVALID_RUNTIME_DOCUMENTS",
        `documentLinks[${index}].documentId must be present and unique`,
      );
    }
    if (!RUNTIME_DOCUMENT_PURPOSES.includes(purpose)) {
      throw createCatalogError(422, "INVALID_RUNTIME_DOCUMENTS", `documentLinks[${index}].purpose is invalid`);
    }
    seen.add(documentId);
    return { documentId, purpose };
  });
}

function normalizeMonitoringRetentionDays(value: unknown, current: Partial<RuntimeFields> | null) {
  const fallback = current?.monitoringRetentionDays ?? DEFAULT_MONITORING_RETENTION_DAYS;
  if (value === undefined || value === null || value === "") return fallback;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 0 || days > CATALOG_LIMITS.monitoringRetentionDays) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_RETENTION",
      `monitoringRetentionDays must be an integer between 0 and ${CATALOG_LIMITS.monitoringRetentionDays}`,
    );
  }
  return days;
}

export function normalizeRuntimeInput(
  payload: Record<string, unknown> = {},
  current: (Partial<RuntimeFields> & { id?: string }) | null = null,
  actor: Partial<Actor> = {},
) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "kind",
      "serverId",
      "endpoint",
      "port",
      "namespace",
      "runtimeName",
      "status",
      "metadata",
      "monitoringRetentionDays",
      "observedAt",
      "documentLinks",
      "operationalNotesMarkdown",
    ],
    "runtime",
  );
  const rawServerId = payload.serverId === undefined ? current?.serverId : payload.serverId;
  const serverId =
    rawServerId === null || rawServerId === "" ? null : optionalText(rawServerId, "serverId", 100) || null;
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(payload.name ?? current?.name, "name", CATALOG_LIMITS.name),
    kind: normalizeEnum(payload.kind, "kind", RUNTIME_KINDS, current?.kind || "other"),
    serverId,
    endpoint: normalizeHttpUrl(payload.endpoint, "endpoint", {
      current: current?.endpoint,
    }),
    port: normalizeOptionalPort(payload.port, current?.port),
    namespace: optionalText(payload.namespace ?? current?.namespace, "namespace", CATALOG_LIMITS.namespace),
    runtimeName: optionalText(payload.runtimeName ?? current?.runtimeName, "runtimeName", CATALOG_LIMITS.runtimeName),
    status: normalizeEnum(payload.status, "status", MUTABLE_RUNTIME_STATUSES, current?.status || "unknown"),
    metadata: normalizeMetadata(payload.metadata, current?.metadata),
    monitoringRetentionDays: normalizeMonitoringRetentionDays(payload.monitoringRetentionDays, current),
    observedAt: normalizeDate(payload.observedAt, "observedAt", current?.observedAt),
    documentLinks: normalizeDocumentLinks(payload.documentLinks, current?.documentLinks),
    operationalNotesMarkdown: optionalText(
      payload.operationalNotesMarkdown ?? current?.operationalNotesMarkdown,
      "operationalNotesMarkdown",
      MAX_OPERATIONAL_NOTES_LENGTH,
    ),
  };
}
