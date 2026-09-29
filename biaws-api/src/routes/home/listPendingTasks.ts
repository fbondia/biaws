import type { Router, Request, Response } from "express";
import { getPendingTasksMetric } from "../../repositories/home/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListPendingTasks(router: Router) {
  router.get(
    "/pending-tasks",
    requireAllPermissions("demands.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await getPendingTasksMetric(req.actor, req.query));
    }),
  );
}
