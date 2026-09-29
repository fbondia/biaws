import type { Request, Response } from "express";
import {
  actorCanAccessApplication,
  authorizationQuery,
} from "../../auth/authorizationMiddleware.js";
import { getRuntimeByReference } from "../../repositories/deployments/index.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

interface AuditMonitor {
  id: string;
  name: string;
}
interface AuditTemplate extends AuditMonitor {
  version: string;
}

export async function scopedRuntime(req: Request, permission: string) {
  const runtime = await getRuntimeByReference(req.params.runtimeReference, {
    workspaceId: req.actor.workspaceId ?? undefined,
    authorizationScope: authorizationQuery(req.actor, permission)
      .authorizationScope,
  });
  return runtime &&
    actorCanAccessApplication(req.actor, permission, runtime.applicationId)
    ? runtime
    : null;
}

export function sendRuntimeNotFound(res: Response) {
  res.status(404).json({
    error: { code: "RUNTIME_NOT_FOUND", message: "Runtime not found" },
  });
}

export function sendActiveMonitorNotFound(res: Response) {
  res.status(404).json({
    error: {
      code: "ACTIVE_MONITOR_NOT_FOUND",
      message: "Active monitor not found",
    },
  });
}

export async function auditActiveMonitorMutation({
  req,
  action,
  runtime,
  before,
  after,
}: {
  req: Request;
  action: string;
  runtime: NonNullable<Awaited<ReturnType<typeof scopedRuntime>>>;
  before?: AuditMonitor | null;
  after?: AuditMonitor | null;
}) {
  const target = after || before;
  if (!target) throw new Error("Active monitor audit target is required");
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: { type: "active-monitor", id: target.id, label: target.name },
    before,
    after,
    metadata: {
      workspaceId: runtime.workspaceId,
      applicationId: runtime.applicationId,
      deploymentId: runtime.deploymentId,
      runtimeId: runtime.id,
    },
    summary: `active monitor ${action}: ${target.name}`,
  });
}

export async function auditTemplateMutation({
  req,
  action,
  before = null,
  after,
}: {
  req: Request;
  action: string;
  before?: AuditTemplate | null;
  after?: AuditTemplate | null;
}) {
  const target = after || before;
  if (!target) throw new Error("Monitoring template audit target is required");
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: {
      type: "monitoring-template",
      id: target.id,
      label: `${target.name} v${target.version}`,
    },
    before,
    after,
    metadata: { workspaceId: req.actor.workspaceId, version: target.version },
    summary: `monitoring template ${action}: ${target.name} v${target.version}`,
  });
}

export const asyncHandler = createReferenceHandler(undefined);
