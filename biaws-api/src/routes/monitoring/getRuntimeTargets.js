import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { listMonitoredRuntimeTargets } from "../../repositories/monitoring/activeMonitors/index.js";
import { asyncHandler } from "./helpers.js";

export function registerGetRuntimeTargets(router) {
  router.get(
    "/runtime-targets",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req, res) => {
      const { authorizationScope } = authorizationQuery(
        req.actor,
        "runtimes.read",
      );
      res.json({
        items: await listMonitoredRuntimeTargets(authorizationScope),
      });
    }),
  );
}
