import { actorCanAccessApplication } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function sendNotFound(res, type) {
  const label = type.replaceAll("-", " ");
  res.status(404).json({
    error: {
      code: `${type.replaceAll("-", "_").toUpperCase()}_NOT_FOUND`,
      message: `${label[0].toUpperCase()}${label.slice(1)} not found`,
    },
  });
}

export async function scopedApplicationEntity(req, permission, getter, id) {
  const entity = await getter(id, { workspaceId: req.actor.workspaceId });
  if (
    !entity ||
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
}) {
  const target = after || before;
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
