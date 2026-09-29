import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { getMonitoredRuntimeTopology } from "../../repositories/monitoring/activeMonitors/index.js";
import { asyncHandler } from "./helpers.js";

export function registerGetRuntimeTopology(router) {
  router.get(
    "/runtime-topology",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req, res) => {
      const { authorizationScope } = authorizationQuery(
        req.actor,
        "runtimes.read",
      );
      res.json({
        topology: await getMonitoredRuntimeTopology(authorizationScope),
      });
    }),
  );
}
