import { Router } from "express";

import {
  actorCanAccessApplication,
  authorizationQuery,
  requireAllPermissions,
  requireWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { getRuntimeByReference } from "../repositories/deploymentsRepository.js";
import { getApplication } from "../repositories/catalogRepository.js";
import {
  recordActiveRuntimeMonitoringObservation,
  getApplicationMonitoringHealth,
  listRuntimeMonitoringTimeline,
  listRuntimeMonitoringSignals,
  recordManualRuntimeMonitoringObservation,
  recordRuntimeMonitoringSignal,
} from "../repositories/runtimeMonitoringRepository.js";
import {
  archiveRuntimeActiveMonitor,
  createRuntimeActiveMonitor,
  getRuntimeActiveMonitor,
  listRuntimeActiveMonitors,
  updateRuntimeActiveMonitor,
} from "../repositories/runtimeActiveMonitoringRepository.js";
import {
  acquireDueActiveMonitors,
  claimActiveMonitorResult,
  completeActiveMonitorExecution,
  renewActiveMonitorLease,
} from "../repositories/runtimeActiveMonitoringExecutionRepository.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { getApplicationHealthMetric } from "../repositories/homeRepository.js";
import {
  archiveMonitoringTemplate,
  createMonitoringTemplate,
  createMonitoringTemplateVersion,
  getMonitoringTemplate,
  listMonitoringTemplates,
  monitoringTemplateUsage,
  previewMonitoringTemplate,
  setMonitoringTemplateStatus,
} from "../repositories/monitoringTemplatesRepository.js";

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

function sendActiveMonitorNotFound(res) {
  res.status(404).json({
    error: {
      code: "ACTIVE_MONITOR_NOT_FOUND",
      message: "Active monitor not found",
    },
  });
}

async function auditActiveMonitorMutation({
  req,
  action,
  runtime,
  before,
  after,
}) {
  const target = after || before;
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

async function auditTemplateMutation({ req, action, before = null, after }) {
  const target = after || before;
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

monitoringRouter.get(
  "/templates",
  requireAllPermissions("runtimes.read"),
  requireWorkspaceScope("runtimes.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listMonitoringTemplates({
        ...req.query,
        workspaceId: req.actor.workspaceId,
      }),
    );
  }),
);

monitoringRouter.post(
  "/templates/preview",
  requireAllPermissions("runtimes.read"),
  requireWorkspaceScope("runtimes.read"),
  asyncHandler(async (req, res) => {
    res.json({ preview: previewMonitoringTemplate(req.body) });
  }),
);

monitoringRouter.post(
  "/templates",
  requireAllPermissions("runtimes.update"),
  requireWorkspaceScope("runtimes.update"),
  asyncHandler(async (req, res) => {
    const template = await createMonitoringTemplate(req.body, req.actor);
    await auditTemplateMutation({ req, action: "created", after: template });
    res.status(201).json({ template });
  }),
);

monitoringRouter.get(
  "/templates/:templateId",
  requireAllPermissions("runtimes.read"),
  requireWorkspaceScope("runtimes.read"),
  asyncHandler(async (req, res) => {
    res.json({
      template: await getMonitoringTemplate(req.params.templateId, {
        ...req.query,
        workspaceId: req.actor.workspaceId,
      }),
    });
  }),
);

monitoringRouter.patch(
  "/templates/:templateId",
  requireAllPermissions("runtimes.update"),
  requireWorkspaceScope("runtimes.update"),
  asyncHandler(async (req, res) => {
    const before = await getMonitoringTemplate(req.params.templateId, {
      workspaceId: req.actor.workspaceId,
    });
    const template = await createMonitoringTemplateVersion(
      req.params.templateId,
      req.body,
      req.actor,
    );
    await auditTemplateMutation({
      req,
      action: "version_created",
      before,
      after: template,
    });
    res.status(201).json({ template });
  }),
);

monitoringRouter.get(
  "/templates/:templateId/versions/:version/usage",
  requireAllPermissions("runtimes.read"),
  requireWorkspaceScope("runtimes.read"),
  asyncHandler(async (req, res) => {
    res.json({
      usage: await monitoringTemplateUsage(
        req.params.templateId,
        req.params.version,
        req.actor.workspaceId,
      ),
    });
  }),
);

for (const [operation, status] of [
  ["activate", "active"],
  ["deactivate", "inactive"],
]) {
  monitoringRouter.post(
    `/templates/:templateId/versions/:version/${operation}`,
    requireAllPermissions("runtimes.update"),
    requireWorkspaceScope("runtimes.update"),
    asyncHandler(async (req, res) => {
      const before = await getMonitoringTemplate(req.params.templateId, {
        version: req.params.version,
        workspaceId: req.actor.workspaceId,
      });
      const template = await setMonitoringTemplateStatus(
        req.params.templateId,
        req.params.version,
        status,
        req.actor,
      );
      await auditTemplateMutation({
        req,
        action: status === "active" ? "activated" : "deactivated",
        before,
        after: template,
      });
      res.json({ template });
    }),
  );
}

monitoringRouter.delete(
  "/templates/:templateId/versions/:version",
  requireAllPermissions("runtimes.update"),
  requireWorkspaceScope("runtimes.update"),
  asyncHandler(async (req, res) => {
    const before = await getMonitoringTemplate(req.params.templateId, {
      version: req.params.version,
      workspaceId: req.actor.workspaceId,
    });
    const template = await archiveMonitoringTemplate(
      req.params.templateId,
      req.params.version,
      req.actor,
    );
    await auditTemplateMutation({
      req,
      action: "archived",
      before,
      after: template,
    });
    res.json({ template });
  }),
);

monitoringRouter.get(
  "/runtimes/:runtimeReference/active-monitors",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.read");
    if (!runtime) return sendRuntimeNotFound(res);
    res.json(
      await listRuntimeActiveMonitors(runtime.id, {
        ...req.query,
        workspaceId: req.actor.workspaceId,
      }),
    );
  }),
);

monitoringRouter.post(
  "/runtimes/:runtimeReference/active-monitors",
  requireAllPermissions("runtimes.update"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.update");
    if (!runtime) return sendRuntimeNotFound(res);
    const monitor = await createRuntimeActiveMonitor(
      runtime.id,
      req.body,
      req.actor,
    );
    await auditActiveMonitorMutation({
      req,
      action: "created",
      runtime,
      before: null,
      after: monitor,
    });
    res.status(201).json({ monitor });
  }),
);

monitoringRouter.patch(
  "/runtimes/:runtimeReference/active-monitors/:monitorId",
  requireAllPermissions("runtimes.update"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.update");
    if (!runtime) return sendRuntimeNotFound(res);
    const before = await getRuntimeActiveMonitor(
      runtime.id,
      req.params.monitorId,
      { workspaceId: req.actor.workspaceId },
    );
    if (!before) return sendActiveMonitorNotFound(res);
    const after = await updateRuntimeActiveMonitor(
      runtime.id,
      before.id,
      req.body,
      req.actor,
    );
    await auditActiveMonitorMutation({
      req,
      action: "updated",
      runtime,
      before,
      after,
    });
    res.json({ monitor: after });
  }),
);

monitoringRouter.delete(
  "/runtimes/:runtimeReference/active-monitors/:monitorId",
  requireAllPermissions("runtimes.update"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedRuntime(req, "runtimes.update");
    if (!runtime) return sendRuntimeNotFound(res);
    const before = await getRuntimeActiveMonitor(
      runtime.id,
      req.params.monitorId,
      { workspaceId: req.actor.workspaceId },
    );
    if (!before) return sendActiveMonitorNotFound(res);
    const after = await archiveRuntimeActiveMonitor(
      runtime.id,
      before.id,
      req.actor,
    );
    await auditActiveMonitorMutation({
      req,
      action: "archived",
      runtime,
      before,
      after,
    });
    res.json({ monitor: after });
  }),
);

monitoringRouter.post(
  "/executor/leases",
  requireAllPermissions("monitoring.active.execute"),
  asyncHandler(async (req, res) => {
    const { authorizationScope } = authorizationQuery(
      req.actor,
      "monitoring.active.execute",
    );
    res.json(await acquireDueActiveMonitors(authorizationScope, req.body));
  }),
);

monitoringRouter.post(
  "/executor/leases/:leaseToken/renew",
  requireAllPermissions("monitoring.active.execute"),
  asyncHandler(async (req, res) => {
    const { authorizationScope } = authorizationQuery(
      req.actor,
      "monitoring.active.execute",
    );
    res.json({
      monitor: await renewActiveMonitorLease(
        req.params.leaseToken,
        req.body,
        authorizationScope,
      ),
    });
  }),
);

monitoringRouter.post(
  "/executor/leases/:leaseToken/results",
  requireAllPermissions("monitoring.active.execute"),
  asyncHandler(async (req, res) => {
    const { authorizationScope } = authorizationQuery(
      req.actor,
      "monitoring.active.execute",
    );
    const monitor = await claimActiveMonitorResult(
      req.params.leaseToken,
      req.body?.executorId,
      authorizationScope,
    );
    const result = await recordActiveRuntimeMonitoringObservation(
      monitor,
      req.body,
      req.actor,
    );
    await completeActiveMonitorExecution(
      monitor,
      req.params.leaseToken,
      result.signal,
    );
    if (result.created) {
      await recordAuditEvent({
        actor: req.actor,
        action: "monitoring_active_observation_recorded",
        target: {
          type: "active-monitor",
          id: monitor.id,
          label: monitor.name,
        },
        after: result.signal,
        metadata: {
          workspaceId: monitor.workspaceId,
          applicationId: monitor.applicationId,
          deploymentId: monitor.deploymentId,
          runtimeId: monitor.runtimeId,
          executionId: monitor.lease.executionId,
        },
        summary: `active monitoring observation recorded: ${monitor.name}`,
      });
    }
    res.status(result.created ? 201 : 200).json(result);
  }),
);

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
    const [health, details] = await Promise.all([
      getApplicationMonitoringHealth(application.id, req.actor.workspaceId),
      getApplicationHealthMetric(req.actor, {
        applicationId: application.id,
      }),
    ]);
    res.json({
      health: { ...health, details },
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
