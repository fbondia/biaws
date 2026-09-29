import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getRuntimeMonitoringHealthSummary } from "../../../repositories/monitoring/events/index.js";
import {
  scopedRuntime,
  sendRuntimeNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListRuntimesHealthSummary(router: Router) {
  router.get(
    "/runtimes/:runtimeReference/health-summary",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const runtime = await scopedRuntime(req, "runtimes.read");
      if (!runtime) return sendRuntimeNotFound(res);
      res.json(
        await getRuntimeMonitoringHealthSummary(runtime.id, {
          ...req.query,
          workspaceId: req.actor.workspaceId ?? undefined,
        }),
      );
    }),
  );
}
