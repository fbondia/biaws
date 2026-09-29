import type { Router, Request, Response } from "express";
import { getHomeMonitoringData } from "../../repositories/home/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListMonitoring(router: Router) {
  router.get(
    "/monitoring",
    requireAllPermissions("runtimes.read"),
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await getHomeMonitoringData(req.actor));
    }),
  );
}
