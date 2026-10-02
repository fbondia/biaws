import type { AuditInput } from "../../types/audit.js";
import { getAuditRetentionDays } from "../../config.js";
import { buildAuditEvent } from "./normalization.js";
import { auditCollection } from "./storage.js";

export async function recordAuditEvent({
  actor,
  action,
  target,
  root = target,
  before = null,
  after = null,
  summary = "",
  metadata = {},
  occurredAt,
}: AuditInput) {
  const document = buildAuditEvent(
    {
      actor,
      action,
      target,
      root,
      before,
      after,
      summary,
      metadata,
      occurredAt,
    },
    { retentionDays: getAuditRetentionDays() },
  );
  const collection = await auditCollection();
  const result = await collection.insertOne(document);
  return { ...document, id: result.insertedId.toString() };
}
