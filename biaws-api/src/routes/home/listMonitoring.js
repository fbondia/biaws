import { getHomeMonitoringData } from "../../repositories/home/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListMonitoring(router) {
  router.get(
    "/monitoring",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req, res) => {
      res.json(await getHomeMonitoringData(req.actor));
    }),
  );
}
