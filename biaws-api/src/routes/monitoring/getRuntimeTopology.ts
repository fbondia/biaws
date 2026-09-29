import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { getMonitoredRuntimeTopology } from "../../repositories/monitoring/activeMonitors/index.js";
import { asyncHandler } from "./helpers.js";

export function registerGetRuntimeTopology(router: Router) {
  router.get(
    "/runtime-topology",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const { authorizationScope } = authorizationQuery(req.actor, "runtimes.read");
      res.json({
        topology: await getMonitoredRuntimeTopology(authorizationScope),
      });
    }),
  );
}
