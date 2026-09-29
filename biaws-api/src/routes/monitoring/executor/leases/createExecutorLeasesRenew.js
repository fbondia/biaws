import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../../auth/authorizationMiddleware.js";
import { renewActiveMonitorLease } from "../../../../repositories/monitoring/activeMonitors/execution/index.js";
import { asyncHandler } from "../../helpers.js";

export function registerCreateExecutorLeasesRenew(router) {
  router.post(
    "/executor/leases/:leaseToken/renew",
    requireAllPermissions("monitoring.active.execute"),
    asyncHandler(async (req, res) => {
      const { authorizationScope } = authorizationQuery(
        req.actor,
        "monitoring.active.execute",
      );
      res.json({
        monitor: await renewActiveMonitorLease(
          req.params.leaseToken,
          req.body,
          authorizationScope,
        ),
      });
    }),
  );
}
