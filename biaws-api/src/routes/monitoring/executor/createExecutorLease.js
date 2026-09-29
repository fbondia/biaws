import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { acquireDueActiveMonitors } from "../../../repositories/monitoring/activeMonitors/execution/index.js";
import { asyncHandler } from "../helpers.js";

export function registerCreateExecutorLease(router) {
  router.post(
    "/executor/leases",
    requireAllPermissions("monitoring.active.execute"),
    asyncHandler(async (req, res) => {
      const { authorizationScope } = authorizationQuery(
        req.actor,
        "monitoring.active.execute",
      );
      res.json(await acquireDueActiveMonitors(authorizationScope, req.body));
    }),
  );
}
