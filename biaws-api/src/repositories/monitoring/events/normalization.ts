import type { Actor } from "../../../types/http.js";
import { SIGNAL_ID_PATTERN, SIGNAL_STATUSES, DAY_MS } from "./constants.js";
import { normalizeMonitoringPayload } from "./payload.js";
import { actorId } from "../../shared/topology/lifecycle.js";
import {
  assertAllowedFields,
  normalizeDate,
  normalizeDocument,
  normalizeEnum,
  normalizeMetadata,
  optionalText,
  requiredText,
} from "../../shared/topology/normalization.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { monitoringMetadataPresentation, normalizeMonitoringMetadataProfile } from "../metadataProfiles/model.js";
import { Document, ObjectId } from "mongodb";

export function normalizeMonitoringSignal(payload: Record<string, unknown> = {}, actor: Partial<Actor> = {}) {
  assertAllowedFields(
    payload,
    ["signalId", "status", "observedAt", "source", "message", "metadata", "metadataProfile", "payload", "templateRef"],
    "monitoring signal",
  );
  const signalId = optionalText(payload.signalId, "signalId", 128);
  if (signalId && !SIGNAL_ID_PATTERN.test(signalId)) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_SIGNAL",
      "signalId must use 1 to 128 letters, numbers, dots, colons, underscores or hyphens",
    );
  }
  const metadata = normalizeMetadata(payload.metadata, {});
  const metadataProfile = normalizeMonitoringMetadataProfile(payload.metadataProfile, metadata);
  return {
    signalId: signalId || null,
    status: normalizeEnum(payload.status, "status", SIGNAL_STATUSES),
    observedAt: normalizeDate(payload.observedAt, "observedAt") || new Date(),
    source: requiredText(payload.source, "source", 160),
    message: optionalText(payload.message, "message", 4_000),
    metadata,
    ...(metadataProfile ? { metadataProfile } : {}),
    payload: normalizeMonitoringPayload(payload.payload),
    recordedBy: actorId(actor),
  };
}

export function monitoringExpirationDate(receivedAt: string | number | Date, retentionDays: number) {
  const days = Number(retentionDays);
  if (!Number.isInteger(days) || days <= 0) return null;
  return new Date(new Date(receivedAt).getTime() + days * DAY_MS);
}

export function normalizeManualMonitoringObservation(
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  assertAllowedFields(
    payload,
    ["status", "observedAt", "source", "message", "metadata"],
    "manual monitoring observation",
  );
  return normalizeMonitoringSignal(
    {
      status: payload.status,
      observedAt: payload.observedAt,
      source: optionalText(payload.source, "source", 160) || "Registro manual",
      message: payload.message,
      metadata: payload.metadata,
    },
    actor,
  );
}

export function monitoringEventResponse(signal: Omit<Document & { _id: ObjectId } & { _id?: unknown }, "_id"> | null) {
  const event = normalizeDocument(signal);
  const metadataPresentation =
    event?.templateSnapshot?.presentation ||
    event?.metadataPresentation ||
    monitoringMetadataPresentation(event?.metadataProfile);
  return {
    ...event,
    origin: !event?.origin || event.origin === "external" ? "passive" : event.origin,
    ...(metadataPresentation ? { metadataPresentation } : {}),
  };
}

export function timelineEvent(signal: Omit<Document & { _id: ObjectId } & { _id?: unknown }, "_id"> | null) {
  return {
    ...monitoringEventResponse(signal),
    payload: signal?.payload ?? null,
  };
}
