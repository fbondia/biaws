import type { Router, Request, Response } from "express";
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

export function registerUpdateRuntimesActiveMonitor(router: Router) {
  router.patch(
    "/runtimes/:runtimeReference/active-monitors/:monitorId",
    requireAllPermissions("runtimes.update"),
    asyncHandler(async (req: Request, res: Response) => {
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
      if (!after) throw new Error("Mutation result is unavailable");
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
