import { getPendingTasksMetric } from "../../repositories/home/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListPendingTasks(router) {
  router.get(
    "/pending-tasks",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req, res) => {
      res.json(await getPendingTasksMetric(req.actor, req.query));
    }),
  );
}
