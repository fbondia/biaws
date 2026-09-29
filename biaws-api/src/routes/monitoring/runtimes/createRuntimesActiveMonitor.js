import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createRuntimeActiveMonitor } from "../../../repositories/monitoring/activeMonitors/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  auditActiveMonitorMutation,
  asyncHandler,
} from "../helpers.js";

export function registerCreateRuntimesActiveMonitor(router) {
  router.post(
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
}
