import { getMonitoringPanelPreference } from "../../repositories/userPreferences/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListMonitoringPanel(router) {
  router.get(
    "/monitoring-panel",
    asyncHandler(async (req, res) => {
      res.json(await getMonitoringPanelPreference(req.actor));
    }),
  );
}
