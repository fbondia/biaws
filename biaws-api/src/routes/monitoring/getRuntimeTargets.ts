import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { listMonitoredRuntimeTargets } from "../../repositories/monitoring/activeMonitors/index.js";
import { asyncHandler } from "./helpers.js";

export function registerGetRuntimeTargets(router: Router) {
  router.get(
    "/runtime-targets",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const { authorizationScope } = authorizationQuery(req.actor, "runtimes.read");
      res.json({
        items: await listMonitoredRuntimeTargets(authorizationScope),
      });
    }),
  );
}
