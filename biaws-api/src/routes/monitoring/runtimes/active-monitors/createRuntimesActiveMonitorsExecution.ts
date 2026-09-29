import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../../auth/authorizationMiddleware.js";
import { requestActiveMonitorExecution } from "../../../../repositories/monitoring/activeMonitors/execution/index.js";
import { recordAuditEvent } from "../../../../repositories/audit/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../../helpers.js";

export function registerCreateRuntimesActiveMonitorsExecution(router: Router) {
  router.post(
    "/runtimes/:runtimeReference/active-monitors/:monitorId/executions",
    requireAllPermissions("monitoring.active.request"),
    asyncHandler(async (req: Request, res: Response) => {
      const runtime = await scopedRuntime(req, "monitoring.active.request");
      if (!runtime) return sendRuntimeNotFound(res);
      const result = await requestActiveMonitorExecution(
        runtime,
        req.params.monitorId,
        req.actor,
      );
      if (result.created) {
        await recordAuditEvent({
          actor: req.actor,
          action: "monitoring_active_execution_requested",
          target: {
            type: "active-monitor",
            id: result.monitor.id,
            label: result.monitor.name,
          },
          after: result.execution,
          metadata: {
            workspaceId: runtime.workspaceId,
            applicationId: runtime.applicationId,
            deploymentId: runtime.deploymentId,
            runtimeId: runtime.id,
            executionId: result.execution.id,
          },
          summary: `active monitor execution requested: ${result.monitor.name}`,
        });
      }
      res.status(result.created ? 202 : 200).json(result);
    }),
  );
}
