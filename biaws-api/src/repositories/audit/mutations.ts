import type { AuditInput } from "../../types/audit.js";
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
}: AuditInput) {
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
