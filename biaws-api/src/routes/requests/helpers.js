import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function documentId(document) {
  return String(document?.id || document?._id || "");
}

export function nestedById(items, id) {
  return (items || []).find((item) => documentId(item) === String(id));
}

export function scopedQuery(req, permission) {
  return authorizationQuery(req.actor, permission, req.query);
}

export async function auditDemand({
  req,
  action,
  summary,
  before,
  after,
  targetType = "demand",
  targetId,
  targetLabel,
}) {
  const demandId = req.params.id || documentId(after || before);
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: {
      type: targetType,
      id: targetId || demandId,
      label: targetLabel || after?.title || before?.title,
    },
    root: { type: "demand", id: demandId },
    before,
    after,
    summary,
    metadata: knowledgeContextMetadata(after || before),
  });
}

export const asyncHandler = createReferenceHandler("demand");
