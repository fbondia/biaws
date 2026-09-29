import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../../../auth/authorizationMiddleware.js";
import { renewActiveMonitorLease } from "../../../../repositories/monitoring/activeMonitors/execution/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerCreateExecutorLeasesRenew(router: Router) {
  router.post(
    "/executor/leases/:leaseToken/renew",
    requireAllPermissions("monitoring.active.execute"),
    asyncHandler(async (req: Request, res: Response) => {
      const { authorizationScope } = authorizationQuery(req.actor, "monitoring.active.execute");
      res.json({
        monitor: await renewActiveMonitorLease(req.params.leaseToken, req.body, authorizationScope),
      });
    }),
  );
}
