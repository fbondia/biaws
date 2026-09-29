import type { Request } from "express";
import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../repositories/shared/knowledgeContext.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function documentId(document?: { id?: string; _id?: unknown } | null) {
  return String(document?.id || document?._id || "");
}

export function requireDemandDocument<T>(document: T | null): T {
  if (!document) {
    throw Object.assign(new Error("Request not found"), { statusCode: 404 });
  }
  return document;
}

export function nestedById<T extends { id?: string; _id?: unknown }>(
  items: T[],
  id: string | string[],
): T | undefined {
  return (items || []).find((item) => documentId(item) === String(id));
}

export function scopedQuery(req: Request, permission: string) {
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
}: {
  req: Request;
  action: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  targetType?: string;
  targetId?: string | string[];
  targetLabel?: string;
}) {
  const target = after || before;
  const targetObject =
    target && typeof target === "object" && !Array.isArray(target)
      ? (target as Record<string, unknown>)
      : null;
  const demandId =
    req.params.id || String(targetObject?.id || targetObject?._id || "");
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: {
      type: targetType,
      id: targetId || demandId,
      label:
        targetLabel ||
        (typeof targetObject?.title === "string"
          ? targetObject.title
          : undefined),
    },
    root: { type: "demand", id: demandId },
    before,
    after,
    summary,
    metadata: knowledgeContextMetadata(targetObject || undefined),
  });
}

export const asyncHandler = createReferenceHandler("demand");
