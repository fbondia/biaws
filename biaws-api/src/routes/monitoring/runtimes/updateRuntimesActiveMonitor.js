import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  getRuntimeActiveMonitor,
  updateRuntimeActiveMonitor,
} from "../../../repositories/monitoring/activeMonitors/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  sendActiveMonitorNotFound,
  auditActiveMonitorMutation,
  asyncHandler,
} from "../helpers.js";

export function registerUpdateRuntimesActiveMonitor(router) {
  router.patch(
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
}
