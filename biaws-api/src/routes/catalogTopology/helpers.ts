import type { Response, Request } from "express";
import { actorCanAccessApplication } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function sendNotFound(res: Response, type: string) {
  const label = type.replaceAll("-", " ");
  res.status(404).json({
    error: {
      code: `${type.replaceAll("-", "_").toUpperCase()}_NOT_FOUND`,
      message: `${label[0].toUpperCase()}${label.slice(1)} not found`,
    },
  });
}

export async function scopedApplicationEntity<
  T extends { applicationId: string | null },
>(
  req: Request,
  permission: string,
  getter: (
    id: string | string[],
    query: { workspaceId?: string },
  ) => Promise<T | null>,
  id: string | string[],
): Promise<T | null> {
  const entity = await getter(id, {
    workspaceId: req.actor.workspaceId ?? undefined,
  });
  if (
    !entity ||
    !entity.applicationId ||
    !actorCanAccessApplication(req.actor, permission, entity.applicationId)
  ) {
    return null;
  }
  return entity;
}

export async function auditMutation({
  req,
  type,
  action,
  before = null,
  after,
}: {
  req: Request;
  type: string;
  action: string;
  before?: {
    id: string;
    name: string;
    workspaceId: string;
    applicationId?: string | null;
    deploymentId?: string;
  } | null;
  after?: {
    id: string;
    name: string;
    workspaceId: string;
    applicationId?: string | null;
    deploymentId?: string;
  } | null;
}) {
  const target = after || before;
  if (!target) throw new Error("Topology audit target is required");
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: { type, id: target.id, label: target.name },
    before,
    after,
    metadata: {
      workspaceId: target.workspaceId,
      applicationId: target.applicationId || null,
      deploymentId: target.deploymentId || null,
    },
    summary: `${type} ${action}: ${target.name}`,
  });
}

export const asyncHandler = createReferenceHandler(undefined);
