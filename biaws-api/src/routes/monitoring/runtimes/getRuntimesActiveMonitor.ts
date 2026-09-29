import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getRuntimeActiveMonitor } from "../../../repositories/monitoring/activeMonitors/index.js";
import { scopedRuntime, sendRuntimeNotFound, sendActiveMonitorNotFound, asyncHandler } from "../helpers.js";

export function registerGetRuntimesActiveMonitor(router: Router) {
  router.get(
    "/runtimes/:runtimeReference/active-monitors/:monitorId",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const runtime = await scopedRuntime(req, "runtimes.read");
      if (!runtime) return sendRuntimeNotFound(res);
      const monitor = await getRuntimeActiveMonitor(runtime.id, req.params.monitorId, {
        workspaceId: req.actor.workspaceId,
      });
      if (!monitor) return sendActiveMonitorNotFound(res);
      res.json({ runtimeId: runtime.id, monitor });
    }),
  );
}
