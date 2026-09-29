import type { Router, Request, Response } from "express";
import { getMonitoringPanelPreference } from "../../repositories/userPreferences/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListMonitoringPanel(router: Router) {
  router.get(
    "/monitoring-panel",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await getMonitoringPanelPreference(req.actor));
    }),
  );
}
