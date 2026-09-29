import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordManualRuntimeMonitoringObservation } from "../../../repositories/monitoring/events/index.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerCreateRuntimesManualObservation(router) {
  router.post(
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
}
