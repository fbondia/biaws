import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../../auth/authorizationMiddleware.js";
import { recordActiveRuntimeMonitoringObservation } from "../../../../repositories/monitoring/events/index.js";
import {
  claimActiveMonitorResult,
  completeActiveMonitorExecution,
} from "../../../../repositories/monitoring/activeMonitors/execution/index.js";
import { recordAuditEvent } from "../../../../repositories/audit/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerCreateExecutorLeasesResult(router) {
  router.post(
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
}
