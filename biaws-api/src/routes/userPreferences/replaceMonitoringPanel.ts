import type { Router, Request, Response } from "express";
import { updateMonitoringPanelPreference } from "../../repositories/userPreferences/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerReplaceMonitoringPanel(router: Router) {
  router.put(
    "/monitoring-panel",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await updateMonitoringPanelPreference(req.body, req.actor));
    }),
  );
}
