import { Router } from "express";

import {
  actorCanAccessApplication,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { getRuntimeByReference } from "../repositories/deploymentsRepository.js";
import { getApplication } from "../repositories/catalogRepository.js";
import {
  getApplicationMonitoringHealth,
  listRuntimeMonitoringTimeline,
  listRuntimeMonitoringSignals,
  recordManualRuntimeMonitoringObservation,
  recordRuntimeMonitoringSignal,
} from "../repositories/runtimeMonitoringRepository.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";

export const monitoringRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

async function scopedRuntime(req, permission) {
  const runtime = await getRuntimeByReference(req.params.runtimeReference, {
    workspaceId: req.actor.workspaceId,
  });
  return runtime &&
    actorCanAccessApplication(req.actor, permission, runtime.applicationId)
    ? runtime
    : null;
}

function sendRuntimeNotFound(res) {
  res.status(404).json({
    error: { code: "RUNTIME_NOT_FOUND", message: "Runtime not found" },
  });
}

monitoringRouter.post(
  "/runtimes/:runtimeReference/manual-observations",
  requireAllPermissions("runtimes.update"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.update");
    if (!runtime) return sendRuntimeNotFound(res);
    const result = await recordManualRuntimeMonitoringObservation(
      runtime.id,
      req.body,
      req.actor,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "monitoring_observation_recorded",
      target: { type: "runtime", id: runtime.id, label: runtime.name },
      after: result.signal,
      metadata: {
        workspaceId: runtime.workspaceId,
        applicationId: runtime.applicationId,
        deploymentId: runtime.deploymentId,
        source: result.signal.source,
      },
      summary: `manual monitoring observation recorded for runtime ${runtime.name}`,
    });
    res.status(201).json(result);
  }),
);

monitoringRouter.post(
  "/runtimes/:runtimeReference/signals",
  requireAllPermissions("monitoring.signals.create"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "monitoring.signals.create");
    if (!runtime) return sendRuntimeNotFound(res);
    const result = await recordRuntimeMonitoringSignal(
      runtime.id,
      req.body,
      req.actor,
    );
    if (result.created) {
      await recordAuditEvent({
        actor: req.actor,
        action: "monitoring_signal_received",
        target: { type: "runtime", id: runtime.id, label: runtime.name },
        before: {
          status: runtime.status,
          monitoring: runtime.monitoring || null,
        },
        after: {
          status: result.runtime.status,
          monitoring: result.runtime.monitoring,
        },
        metadata: {
          workspaceId: runtime.workspaceId,
          applicationId: runtime.applicationId,
          deploymentId: runtime.deploymentId,
          signalId: result.signal.signalId,
          source: result.signal.source,
        },
        summary: `monitoring signal received for runtime ${runtime.name}`,
      });
    }
    res.status(result.created ? 201 : 200).json(result);
  }),
);

monitoringRouter.get(
  "/applications/:applicationId/health",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    const application = await getApplication(req.params.applicationId, {
      workspaceId: req.actor.workspaceId,
    });
    if (
      !application ||
      !actorCanAccessApplication(req.actor, "runtimes.read", application.id)
    ) {
      res.status(404).json({
        error: {
          code: "APPLICATION_NOT_FOUND",
          message: "Application not found",
        },
      });
      return;
    }
    res.json({
      health: await getApplicationMonitoringHealth(
        application.id,
        req.actor.workspaceId,
      ),
    });
  }),
);

monitoringRouter.get(
  "/runtimes/:runtimeReference/timeline",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.read");
    if (!runtime) return sendRuntimeNotFound(res);
    res.json(
      await listRuntimeMonitoringTimeline(runtime.id, {
        ...req.query,
        workspaceId: req.actor.workspaceId,
      }),
    );
  }),
);

monitoringRouter.get(
  "/runtimes/:runtimeReference/signals",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.read");
    if (!runtime) return sendRuntimeNotFound(res);
    res.json(
      await listRuntimeMonitoringSignals(runtime.id, {
        ...req.query,
        workspaceId: req.actor.workspaceId,
      }),
    );
  }),
);
