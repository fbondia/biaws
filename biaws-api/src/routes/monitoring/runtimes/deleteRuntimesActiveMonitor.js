import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  archiveRuntimeActiveMonitor,
  getRuntimeActiveMonitor,
} from "../../../repositories/monitoring/activeMonitors/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  sendActiveMonitorNotFound,
  auditActiveMonitorMutation,
  asyncHandler,
} from "../helpers.js";

export function registerDeleteRuntimesActiveMonitor(router) {
  router.delete(
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
}
