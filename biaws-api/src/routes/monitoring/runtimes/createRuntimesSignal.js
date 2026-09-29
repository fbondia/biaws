import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordRuntimeMonitoringSignal } from "../../../repositories/monitoring/events/index.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerCreateRuntimesSignal(router) {
  router.post(
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
}
